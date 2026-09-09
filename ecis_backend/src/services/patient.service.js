const pool = require("../config/database");

/* ============================================================
   HELPERS
   ============================================================ */

function cleanString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const valueString = String(value).trim();

  return valueString ? valueString : null;
}

function cleanArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)),
  ];
}

/* ============================================================
   PATIENT NUMBER
   ============================================================ */

async function generatePatientNumber(client) {
  const result = await client.query(`
      SELECT
        COALESCE(
          MAX(
            CASE
              WHEN patient_number ~ '^P[0-9]+$'
              THEN CAST(
                SUBSTRING(
                  patient_number
                  FROM 2
                ) AS INTEGER
              )
              ELSE 0
            END
          ),
          0
        ) + 1 AS next_number
      FROM public.patients;
    `);

  const nextNumber = Number(result.rows[0].next_number);

  return `P${String(nextNumber).padStart(6, "0")}`;
}

/* ============================================================
   INSERT ALLERGIES
   ============================================================ */

async function saveAllergies(client, patientId, allergyNames, category) {
  const names = cleanArray(allergyNames);

  for (const allergyName of names) {
    const allergyResult = await client.query(
      `
          INSERT INTO public.allergies (
            allergy_name,
            allergy_category
          )
          VALUES ($1, $2)

          ON CONFLICT (
            allergy_name,
            allergy_category
          )

          DO UPDATE
          SET allergy_name =
              EXCLUDED.allergy_name

          RETURNING allergy_id;
        `,
      [allergyName, category],
    );

    const allergyId = allergyResult.rows[0].allergy_id;

    await client.query(
      `
        INSERT INTO public.patient_allergies (
          patient_id,
          allergy_id
        )
        VALUES ($1, $2)

        ON CONFLICT (
          patient_id,
          allergy_id
        )

        DO NOTHING;
      `,
      [patientId, allergyId],
    );
  }
}

/* ============================================================
   CREATE PATIENT
   ============================================================ */

async function createPatient(data) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const hospitalId = data.hospitalId;

    if (!hospitalId) {
      throw new Error("Hospital ID is required.");
    }

    /* --------------------------------------------------------
       Verify hospital
       -------------------------------------------------------- */

    const hospital = await client.query(
      `
          SELECT hospital_id
          FROM public.hospitals
          WHERE hospital_id = $1;
        `,
      [hospitalId],
    );

    if (hospital.rowCount === 0) {
      throw new Error("Hospital not found.");
    }

    /* --------------------------------------------------------
       Generate patient number
       -------------------------------------------------------- */

    const patientNumber = await generatePatientNumber(client);

    /* --------------------------------------------------------
       Insert patient
       -------------------------------------------------------- */

    const patientResult = await client.query(
      `
          INSERT INTO public.patients (
            hospital_id,
            patient_number,

            nic_number,
            passport_number,

            first_name,
            middle_name,
            last_name,

            date_of_birth,
            gender,
            blood_group,

            height_cm,
            weight_kg,

            nationality,

            primary_phone,
            secondary_phone,

            email,
            occupation,

            address,
            province,
            district,

            registration_notes,

            status
          )

          VALUES (
            $1,
            $2,

            $3,
            $4,

            $5,
            $6,
            $7,

            $8,
            $9,
            $10,

            $11,
            $12,

            $13,

            $14,
            $15,

            $16,
            $17,

            $18,
            $19,
            $20,

            $21,

            $22
          )

          RETURNING patient_id;
        `,
      [
        hospitalId,
        patientNumber,

        cleanString(data.nicNumber),

        cleanString(data.passportNumber),

        cleanString(data.firstName),

        cleanString(data.middleName),

        cleanString(data.lastName),

        data.dateOfBirth || null,

        cleanString(data.gender),

        cleanString(data.bloodGroup),

        data.heightCm !== undefined &&
        data.heightCm !== null &&
        data.heightCm !== ""
          ? Number(data.heightCm)
          : null,

        data.weightKg !== undefined &&
        data.weightKg !== null &&
        data.weightKg !== ""
          ? Number(data.weightKg)
          : null,

        cleanString(data.nationality) || "Sri Lankan",

        cleanString(data.primaryPhone),

        cleanString(data.secondaryPhone),

        cleanString(data.email),

        cleanString(data.occupation),

        cleanString(data.address),

        cleanString(data.province),

        cleanString(data.district),

        cleanString(data.registrationNotes),

        cleanString(data.status) || "ACTIVE",
      ],
    );

    const patientId = patientResult.rows[0].patient_id;

    /* --------------------------------------------------------
       Food allergies
       -------------------------------------------------------- */

    await saveAllergies(client, patientId, data.foodAllergies, "FOOD");

    /* --------------------------------------------------------
       Medical / drug allergies
       -------------------------------------------------------- */

    await saveAllergies(
      client,
      patientId,
      data.medicalAllergies,
      "MEDICAL_DRUG",
    );

    await client.query("COMMIT");

    /*
     * IMPORTANT:
     * Return the actual complete database record.
     */
    return await getPatientById(patientId);
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}

/* ============================================================
   GET PATIENT BY ID
   ============================================================ */

async function getPatientById(patientId) {
  const result = await pool.query(
    `
        SELECT
          p.patient_id,
          p.hospital_id,

          p.patient_number,

          p.nic_number,
          p.passport_number,

          p.first_name,
          p.middle_name,
          p.last_name,

          p.date_of_birth,
          p.gender,
          p.blood_group,

          p.height_cm,
          p.weight_kg,

          p.nationality,

          p.primary_phone,
          p.secondary_phone,

          p.email,
          p.occupation,

          p.address,
          p.province,
          p.district,

          p.registration_notes,

          p.status,

          p.registered_at,
          p.created_at,
          p.updated_at,

          h.hospital_code,
          h.hospital_name,

          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id',
                  a.allergy_id,

                  'name',
                  a.allergy_name,

                  'category',
                  a.allergy_category,

                  'reaction',
                  pa.reaction,

                  'notes',
                  pa.notes
                )

                ORDER BY
                  a.allergy_category,
                  a.allergy_name
              )

              FROM public.patient_allergies pa

              INNER JOIN public.allergies a
                ON a.allergy_id =
                   pa.allergy_id

              WHERE
                pa.patient_id =
                  p.patient_id
            ),

            '[]'::jsonb
          ) AS allergies

        FROM public.patients p

        INNER JOIN public.hospitals h
          ON h.hospital_id =
             p.hospital_id

        WHERE
          p.patient_id = $1;
      `,
    [patientId],
  );

  return result.rows[0] || null;
}

/* ============================================================
   GET ALL PATIENTS
   ============================================================ */

async function getAllPatients(hospitalId) {
  const result = await pool.query(
    `
        SELECT
          p.patient_id,
          p.hospital_id,

          p.patient_number,

          p.nic_number,
          p.passport_number,

          p.first_name,
          p.middle_name,
          p.last_name,

          p.date_of_birth,
          p.gender,
          p.blood_group,

          p.height_cm,
          p.weight_kg,

          p.nationality,

          p.primary_phone,
          p.secondary_phone,

          p.email,
          p.occupation,

          p.address,
          p.province,
          p.district,

          p.registration_notes,

          p.status,

          p.registered_at,
          p.created_at,
          p.updated_at,

          h.hospital_code,
          h.hospital_name,

          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id',
                  a.allergy_id,

                  'name',
                  a.allergy_name,

                  'category',
                  a.allergy_category
                )

                ORDER BY
                  a.allergy_category,
                  a.allergy_name
              )

              FROM public.patient_allergies pa

              INNER JOIN public.allergies a
                ON a.allergy_id =
                   pa.allergy_id

              WHERE
                pa.patient_id =
                  p.patient_id
            ),

            '[]'::jsonb
          ) AS allergies

        FROM public.patients p

        INNER JOIN public.hospitals h
          ON h.hospital_id =
             p.hospital_id

        WHERE
          p.hospital_id = $1

        ORDER BY
          p.created_at DESC;
      `,
    [hospitalId],
  );

  return result.rows;
}

/* ============================================================
   SEARCH PATIENTS
   ============================================================ */

async function searchPatients(hospitalId, searchTerm) {
  const result = await pool.query(
    `
        SELECT
          p.patient_id,
          p.hospital_id,

          p.patient_number,

          p.nic_number,

          p.first_name,
          p.middle_name,
          p.last_name,

          p.date_of_birth,
          p.gender,
          p.blood_group,

          p.height_cm,
          p.weight_kg,

          p.primary_phone,

          p.address,
          p.province,
          p.district,

          p.occupation,

          p.status,

          h.hospital_code,
          h.hospital_name

        FROM public.patients p

        INNER JOIN public.hospitals h
          ON h.hospital_id =
             p.hospital_id

        WHERE
          p.hospital_id = $1

          AND (
            p.patient_number ILIKE $2
            OR p.first_name ILIKE $2
            OR p.middle_name ILIKE $2
            OR p.last_name ILIKE $2
            OR p.nic_number ILIKE $2
            OR p.primary_phone ILIKE $2
          )

        ORDER BY
          p.first_name,
          p.last_name

        LIMIT 20;
      `,
    [hospitalId, `%${searchTerm}%`],
  );

  return result.rows;
}

/* ============================================================
   UPDATE PATIENT
   ============================================================ */

async function updatePatient(patientId, data) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current = await client.query(
      `
          SELECT
            patient_id
          FROM public.patients
          WHERE patient_id = $1;
        `,
      [patientId],
    );

    if (current.rowCount === 0) {
      await client.query("ROLLBACK");

      return null;
    }

    const updated = await client.query(
      `
          UPDATE public.patients

          SET
            first_name =
              COALESCE(
                $1,
                first_name
              ),

            middle_name =
              COALESCE(
                $2,
                middle_name
              ),

            last_name =
              COALESCE(
                $3,
                last_name
              ),

            date_of_birth =
              COALESCE(
                $4,
                date_of_birth
              ),

            gender =
              COALESCE(
                $5,
                gender
              ),

            blood_group =
              COALESCE(
                $6,
                blood_group
              ),

            height_cm =
              COALESCE(
                $7,
                height_cm
              ),

            weight_kg =
              COALESCE(
                $8,
                weight_kg
              ),

            nationality =
              COALESCE(
                $9,
                nationality
              ),

            primary_phone =
              COALESCE(
                $10,
                primary_phone
              ),

            secondary_phone =
              COALESCE(
                $11,
                secondary_phone
              ),

            email =
              COALESCE(
                $12,
                email
              ),

            occupation =
              COALESCE(
                $13,
                occupation
              ),

            address =
              COALESCE(
                $14,
                address
              ),

            province =
              COALESCE(
                $15,
                province
              ),

            district =
              COALESCE(
                $16,
                district
              ),

            registration_notes =
              COALESCE(
                $17,
                registration_notes
              ),

            status =
              COALESCE(
                $18,
                status
              ),

            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            patient_id = $19

          RETURNING
            patient_id;
        `,
      [
        cleanString(data.firstName),

        cleanString(data.middleName),

        cleanString(data.lastName),

        data.dateOfBirth || null,

        cleanString(data.gender),

        cleanString(data.bloodGroup),

        data.heightCm !== undefined ? Number(data.heightCm) : null,

        data.weightKg !== undefined ? Number(data.weightKg) : null,

        cleanString(data.nationality),

        cleanString(data.primaryPhone),

        cleanString(data.secondaryPhone),

        cleanString(data.email),

        cleanString(data.occupation),

        cleanString(data.address),

        cleanString(data.province),

        cleanString(data.district),

        cleanString(data.registrationNotes),

        cleanString(data.status),

        patientId,
      ],
    );

    if (updated.rowCount === 0) {
      await client.query("ROLLBACK");

      return null;
    }

    /*
     * Replace allergy relationships only
     * when allergy arrays are supplied.
     */

    if (
      Array.isArray(data.foodAllergies) ||
      Array.isArray(data.medicalAllergies)
    ) {
      await client.query(
        `
          DELETE FROM public.patient_allergies
          WHERE patient_id = $1;
        `,
        [patientId],
      );

      await saveAllergies(client, patientId, data.foodAllergies || [], "FOOD");

      await saveAllergies(
        client,
        patientId,
        data.medicalAllergies || [],
        "MEDICAL_DRUG",
      );
    }

    await client.query("COMMIT");

    return await getPatientById(patientId);
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createPatient,

  getPatientById,

  getAllPatients,

  searchPatients,

  updatePatient,
};
