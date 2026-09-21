const pool = require("../config/database");

function cleanString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();

  return text || null;
}

function cleanArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)),
  ];
}

function parseNullableNumber(
  value,
  field,
  { min = 0, max = Number.MAX_SAFE_INTEGER } = {},
) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(
      `${field} must be a valid number between ${min} and ${max}.`,
    );
  }

  return number;
}

function validateDateOfBirth(value) {
  if (!value) {
    throw new Error("Date of birth is required.");
  }

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date of birth.");
  }

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  if (date > today) {
    throw new Error("Date of birth cannot be in the future.");
  }

  const age =
    today.getFullYear() -
    date.getFullYear() -
    (today.getMonth() < date.getMonth() ||
    (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())
      ? 1
      : 0);

  if (age < 18 || age > 120) {
    throw new Error(
      "Date of birth must represent an age between 0 and 120 years.",
    );
  }

  return String(value).slice(0, 10);
}

async function generatePatientNumber(client) {
  // Prevent two simultaneous registrations
  // from generating the same patient number.
  await client.query("SELECT pg_advisory_xact_lock($1);", [271828182]);

  const result = await client.query(`
      SELECT COALESCE(
        MAX(
          CASE
            WHEN patient_number ~ '^P[0-9]+$'
              THEN CAST(
                SUBSTRING(
                  patient_number
                  FROM 2
                ) AS BIGINT
              )
            ELSE 0
          END
        ),
        0
      ) + 1 AS next_number
      FROM public.patients;
    `);

  return `P${String(result.rows[0].next_number).padStart(6, "0")}`;
}

async function saveAllergies(client, patientId, names, category) {
  for (const allergyName of cleanArray(names)) {
    const allergy = await client.query(
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
        DO UPDATE SET
          allergy_name =
            EXCLUDED.allergy_name
        RETURNING allergy_id;
        `,
      [allergyName, category],
    );

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
      [patientId, allergy.rows[0].allergy_id],
    );
  }
}

const patientSelect = `
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

    EXTRACT(
      YEAR
      FROM AGE(
        CURRENT_DATE,
        p.date_of_birth
      )
    )::int AS age,

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
        FROM
          public.patient_allergies pa
        JOIN
          public.allergies a
            ON a.allergy_id =
               pa.allergy_id
        WHERE
          pa.patient_id =
            p.patient_id
      ),
      '[]'::jsonb
    ) AS allergies
`;

async function createPatient(data) {
  const hospitalId = Number(data.hospitalId);

  if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
    throw new Error("Hospital context is required.");
  }

  const firstName = cleanString(data.firstName);

  const lastName = cleanString(data.lastName);

  if (!firstName || !lastName) {
    throw new Error("First name and last name are required.");
  }

  const dateOfBirth = validateDateOfBirth(data.dateOfBirth);

  const heightCm = parseNullableNumber(data.heightCm, "Height", {
    min: 1,
    max: 300,
  });

  const weightKg = parseNullableNumber(data.weightKg, "Weight", {
    min: 1,
    max: 500,
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const hospital = await client.query(
      `
        SELECT 1
        FROM public.hospitals
        WHERE hospital_id = $1;
        `,
      [hospitalId],
    );

    if (!hospital.rowCount) {
      throw new Error("Hospital not found.");
    }

    const nic = cleanString(data.nicNumber);

    if (nic) {
      const duplicate = await client.query(
        `
          SELECT 1
          FROM public.patients
          WHERE nic_number = $1
          LIMIT 1;
          `,
        [nic],
      );

      if (duplicate.rowCount) {
        throw new Error("A patient with this NIC already exists.");
      }
    }

    const patientNumber = await generatePatientNumber(client);

    const result = await client.query(
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
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,$10,$11,$12,
          $13,$14,$15,$16,$17,$18,
          $19,$20,$21,$22
        )
        RETURNING patient_id;
        `,
      [
        hospitalId,
        patientNumber,
        nic,
        cleanString(data.passportNumber),
        firstName,
        cleanString(data.middleName),
        lastName,
        dateOfBirth,
        cleanString(data.gender),
        cleanString(data.bloodGroup),
        heightCm,
        weightKg,
        cleanString(data.nationality) || "Sri Lankan",
        cleanString(data.primaryPhone),
        cleanString(data.secondaryPhone),
        cleanString(data.email),
        cleanString(data.occupation),
        cleanString(data.address),
        cleanString(data.province),
        cleanString(data.district),
        cleanString(data.registrationNotes),
        "ACTIVE",
      ],
    );

    const patientId = result.rows[0].patient_id;

    await saveAllergies(client, patientId, data.foodAllergies, "FOOD");

    await saveAllergies(
      client,
      patientId,
      data.medicalAllergies,
      "MEDICAL_DRUG",
    );

    await client.query("COMMIT");

    return getPatientById(patientId, hospitalId);
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}

async function getPatientById(patientId, hospitalId) {
  const params = [Number(patientId)];

  let where = "p.patient_id = $1";

  if (hospitalId !== undefined) {
    params.push(Number(hospitalId));

    where += " AND p.hospital_id = $2";
  }

  const result = await pool.query(
    `
      ${patientSelect}
      FROM public.patients p
      JOIN public.hospitals h
        ON h.hospital_id =
           p.hospital_id
      WHERE ${where}
      LIMIT 1;
      `,
    params,
  );

  return result.rows[0] || null;
}

async function getAllPatients(hospitalId) {
  const result = await pool.query(
    `
      ${patientSelect}
      FROM public.patients p
      JOIN public.hospitals h
        ON h.hospital_id =
           p.hospital_id
      WHERE p.hospital_id = $1
      ORDER BY
        p.created_at DESC,
        p.patient_id DESC;
      `,
    [Number(hospitalId)],
  );

  return result.rows;
}

async function searchPatients(hospitalId, searchTerm) {
  const term = `%${String(searchTerm).trim()}%`;

  const result = await pool.query(
    `
      ${patientSelect}
      FROM public.patients p
      JOIN public.hospitals h
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
          OR p.address ILIKE $2
          OR p.district ILIKE $2
          OR p.province ILIKE $2
        )
      ORDER BY
        p.first_name,
        p.last_name
      LIMIT 50;
      `,
    [Number(hospitalId), term],
  );

  return result.rows;
}

async function updatePatient(patientId, hospitalId, data) {
  const id = Number(patientId);

  const hospital = Number(hospitalId);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current = await client.query(
      `
        SELECT
          patient_id,
          date_of_birth,
          nic_number
        FROM public.patients
        WHERE
          patient_id = $1
          AND hospital_id = $2
        FOR UPDATE;
        `,
      [id, hospital],
    );

    if (!current.rowCount) {
      await client.query("ROLLBACK");

      return null;
    }

    const fields = [];
    const values = [];

    const add = (column, value) => {
      fields.push(`${column} = $${values.length + 1}`);

      values.push(value);
    };

    const provided = (key) => Object.prototype.hasOwnProperty.call(data, key);

    if (provided("firstName")) {
      add("first_name", cleanString(data.firstName));
    }

    if (provided("middleName")) {
      add("middle_name", cleanString(data.middleName));
    }

    if (provided("lastName")) {
      add("last_name", cleanString(data.lastName));
    }

    if (provided("dateOfBirth")) {
      add("date_of_birth", validateDateOfBirth(data.dateOfBirth));
    }

    if (provided("gender")) {
      add("gender", cleanString(data.gender));
    }

    if (provided("bloodGroup")) {
      add("blood_group", cleanString(data.bloodGroup));
    }

    if (provided("heightCm")) {
      add(
        "height_cm",
        parseNullableNumber(data.heightCm, "Height", {
          min: 1,
          max: 300,
        }),
      );
    }

    if (provided("weightKg")) {
      add(
        "weight_kg",
        parseNullableNumber(data.weightKg, "Weight", {
          min: 1,
          max: 500,
        }),
      );
    }

    if (provided("nationality")) {
      add("nationality", cleanString(data.nationality));
    }

    if (provided("primaryPhone")) {
      add("primary_phone", cleanString(data.primaryPhone));
    }

    if (provided("secondaryPhone")) {
      add("secondary_phone", cleanString(data.secondaryPhone));
    }

    if (provided("email")) {
      add("email", cleanString(data.email));
    }

    if (provided("occupation")) {
      add("occupation", cleanString(data.occupation));
    }

    if (provided("address")) {
      add("address", cleanString(data.address));
    }

    if (provided("province")) {
      add("province", cleanString(data.province));
    }

    if (provided("district")) {
      add("district", cleanString(data.district));
    }

    if (provided("registrationNotes")) {
      add("registration_notes", cleanString(data.registrationNotes));
    }

    if (provided("nicNumber")) {
      const nic = cleanString(data.nicNumber);

      if (nic) {
        const duplicate = await client.query(
          `
            SELECT 1
            FROM public.patients
            WHERE
              nic_number = $1
              AND patient_id <> $2
            LIMIT 1;
            `,
          [nic, id],
        );

        if (duplicate.rowCount) {
          throw new Error("A patient with this NIC already exists.");
        }
      }

      add("nic_number", nic);
    }

    if (provided("passportNumber")) {
      add("passport_number", cleanString(data.passportNumber));
    }

    if (fields.length) {
      fields.push("updated_at = CURRENT_TIMESTAMP");

      const updated = await client.query(
        `
          UPDATE public.patients
          SET ${fields.join(", ")}
          WHERE
            patient_id = $${values.length + 1}
            AND hospital_id = $${values.length + 2}
          RETURNING patient_id;
          `,
        [...values, id, hospital],
      );

      if (!updated.rowCount) {
        throw new Error("Patient update failed.");
      }
    }

    if (
      Array.isArray(data.foodAllergies) ||
      Array.isArray(data.medicalAllergies)
    ) {
      await client.query(
        `
        DELETE FROM public.patient_allergies
        WHERE patient_id = $1;
        `,
        [id],
      );

      await saveAllergies(client, id, data.foodAllergies || [], "FOOD");

      await saveAllergies(
        client,
        id,
        data.medicalAllergies || [],
        "MEDICAL_DRUG",
      );
    }

    await client.query("COMMIT");

    return getPatientById(id, hospital);
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
