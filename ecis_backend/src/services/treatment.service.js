const pool =
  require("../config/database");

function nullableId(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  if (
    !Number.isInteger(number) ||
    number <= 0
  ) {
    throw new Error(
      "Invalid identifier.",
    );
  }

  return number;
}

async function createTreatment(
  treatmentData,
  authUser,
) {
  const patientId =
    nullableId(
      treatmentData.patientId,
    );

  const hospitalId =
    nullableId(
      authUser?.hospitalId,
    );

  const performedBy =
    nullableId(
      treatmentData.performedBy,
    ) ||
    nullableId(
      authUser?.userId,
    );

  if (
    !patientId ||
    !hospitalId
  ) {
    throw new Error(
      "Authenticated patient and hospital context are required.",
    );
  }

  if (
    !treatmentData.treatmentType ||
    !String(
      treatmentData.treatmentType,
    ).trim()
  ) {
    throw new Error(
      "treatmentType is required.",
    );
  }

  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN",
    );

    const patient =
      await client.query(
        `
        SELECT patient_id
        FROM public.patients
        WHERE
          patient_id = $1
          AND hospital_id = $2
          AND status = 'ACTIVE'
        FOR SHARE;
        `,
        [
          patientId,
          hospitalId,
        ],
      );

    if (!patient.rowCount) {
      throw new Error(
        "Patient not found in the authenticated hospital.",
      );
    }

    if (performedBy) {
      const user =
        await client.query(
          `
          SELECT user_id
          FROM public.hospital_users
          WHERE
            user_id = $1
            AND hospital_id = $2
            AND is_active = TRUE;
          `,
          [
            performedBy,
            hospitalId,
          ],
        );

      if (!user.rowCount) {
        throw new Error(
          "The selected clinician is not active in this hospital.",
        );
      }
    }

    let encounterId =
      nullableId(
        treatmentData.encounterId,
      );

    if (encounterId) {
      const encounter =
        await client.query(
          `
          SELECT encounter_id
          FROM public.encounters
          WHERE
            encounter_id = $1
            AND patient_id = $2
            AND hospital_id = $3
          FOR SHARE;
          `,
          [
            encounterId,
            patientId,
            hospitalId,
          ],
        );

      if (!encounter.rowCount) {
        throw new Error(
          "Encounter does not belong to the selected patient and hospital.",
        );
      }
    } else {
      const encounter =
        await client.query(
          `
          INSERT INTO public.encounters (
            patient_id,
            hospital_id,
            encounter_type,
            encounter_date,
            attending_user_id,
            department,
            status,
            chief_complaint,
            notes
          )
          VALUES (
            $1,
            $2,
            $3,
            COALESCE(
              $4::timestamp,
              CURRENT_TIMESTAMP
            ),
            $5,
            $6,
            'COMPLETED',
            $7,
            $8
          )
          RETURNING encounter_id;
          `,
          [
            patientId,
            hospitalId,
            String(
              treatmentData.treatmentType,
            ).toUpperCase(),
            treatmentData.treatmentDate ||
              null,
            performedBy,
            treatmentData.department ||
              null,
            treatmentData.diagnosis ||
              null,
            treatmentData.description ||
              null,
          ],
        );

      encounterId =
        encounter.rows[0]
          .encounter_id;
    }

    const result =
      await client.query(
        `
        INSERT INTO public.treatment_records (
          patient_id,
          encounter_id,
          opd_visit_id,
          clinic_visit_id,
          admission_id,
          emergency_case_id,
          treatment_date,
          treatment_type,
          treatment_name,
          description,
          body_site,
          laterality,
          performed_by,
          outcome,
          complications
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          COALESCE(
            $7::timestamp,
            CURRENT_TIMESTAMP
          ),
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15
        )
        RETURNING *;
        `,
        [
          patientId,
          encounterId,
          nullableId(
            treatmentData.opdVisitId,
          ),
          nullableId(
            treatmentData.clinicVisitId,
          ),
          nullableId(
            treatmentData.admissionId,
          ),
          nullableId(
            treatmentData.emergencyCaseId,
          ),
          treatmentData.treatmentDate ||
            null,
          String(
            treatmentData.treatmentType,
          )
            .trim()
            .toUpperCase(),
          treatmentData.treatmentName ||
            null,
          treatmentData.description ||
            null,
          treatmentData.bodySite ||
            null,
          treatmentData.laterality ||
            null,
          performedBy,
          treatmentData.outcome ||
            null,
          treatmentData.complications ||
            null,
        ],
      );

    await client.query(
      "COMMIT",
    );

    return getTreatmentById(
      result.rows[0]
        .treatment_id,
      hospitalId,
    );
  } catch (error) {
    await client.query(
      "ROLLBACK",
    );

    throw error;
  } finally {
    client.release();
  }
}

async function getPatientTreatments(
  patientId,
  hospitalId,
) {
  const result =
    await pool.query(
      `
      SELECT
        t.treatment_id,
        t.patient_id,
        t.encounter_id,
        t.treatment_date,
        t.treatment_type,
        t.treatment_name,
        t.description,
        t.body_site,
        t.laterality,
        t.outcome,
        t.complications,
        t.opd_visit_id,
        t.clinic_visit_id,
        t.admission_id,
        t.emergency_case_id,

        p.patient_number,

        u.user_id
          AS performed_by_id,

        u.full_name
          AS performed_by_name,

        e.department,

        e.chief_complaint
          AS diagnosis

      FROM
        public.treatment_records t

      JOIN
        public.patients p
          ON p.patient_id =
             t.patient_id

      LEFT JOIN
        public.hospital_users u
          ON u.user_id =
             t.performed_by

      LEFT JOIN
        public.encounters e
          ON e.encounter_id =
             t.encounter_id

      WHERE
        t.patient_id = $1
        AND p.hospital_id = $2

      ORDER BY
        t.treatment_date DESC,
        t.treatment_id DESC;
      `,
      [
        Number(patientId),
        Number(hospitalId),
      ],
    );

  return result.rows;
}

async function getTreatmentById(
  treatmentId,
  hospitalId,
) {
  const result =
    await pool.query(
      `
      SELECT
        t.*,
        p.patient_number,
        p.first_name,
        p.last_name,
        u.full_name
          AS performed_by_name

      FROM
        public.treatment_records t

      JOIN
        public.patients p
          ON p.patient_id =
             t.patient_id

      LEFT JOIN
        public.hospital_users u
          ON u.user_id =
             t.performed_by

      WHERE
        t.treatment_id = $1
        AND p.hospital_id = $2

      LIMIT 1;
      `,
      [
        Number(treatmentId),
        Number(hospitalId),
      ],
    );

  return (
    result.rows[0] ||
    null
  );
}

async function getAllTreatments(
  hospitalId,
) {
  const result =
    await pool.query(
      `
      SELECT
        t.treatment_id,
        t.patient_id,
        t.encounter_id,
        t.opd_visit_id,
        t.clinic_visit_id,
        t.admission_id,
        t.emergency_case_id,
        t.treatment_date,
        t.treatment_type,
        t.treatment_name,
        t.description,
        t.body_site,
        t.laterality,
        t.performed_by,
        t.outcome,
        t.complications,

        p.patient_number,
        p.first_name,
        p.last_name,

        u.full_name
          AS performed_by_name,

        e.department

      FROM
        public.treatment_records t

      JOIN
        public.patients p
          ON p.patient_id =
             t.patient_id

      LEFT JOIN
        public.hospital_users u
          ON u.user_id =
             t.performed_by

      LEFT JOIN
        public.encounters e
          ON e.encounter_id =
             t.encounter_id

      WHERE
        p.hospital_id = $1

      ORDER BY
        t.treatment_date DESC,
        t.treatment_id DESC;
      `,
      [
        Number(hospitalId),
      ],
    );

  return result.rows;
}

module.exports = {
  createTreatment,
  getAllTreatments,
  getPatientTreatments,
  getTreatmentById,
};