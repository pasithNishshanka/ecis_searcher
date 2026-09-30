const pool =
  require("../config/database");
const { hasLocalSystemAdminAccess } = require("../config/localAccess");


function positiveInteger(
  value,
  fieldName,
) {
  const number =
    Number(value);

  if (
    !Number.isInteger(
      number,
    ) ||
    number <= 0
  ) {
    throw new Error(
      `${fieldName} must be a positive integer`,
    );
  }

  return number;
}


function nullableText(
  value,
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const text =
    String(
      value,
    ).trim();

  return text || null;
}


async function confirmIdentity(
  confirmationData,
) {
  const hospitalId =
    positiveInteger(
      confirmationData.hospitalId,
      "hospitalId",
    );

  const emergencyCaseId =
    positiveInteger(
      confirmationData.emergencyCaseId,
      "emergencyCaseId",
    );

  const patientId =
    positiveInteger(
      confirmationData.patientId,
      "patientId",
    );

  const reviewerUserId =
    positiveInteger(
      confirmationData.reviewerUserId,
      "reviewerUserId",
    );

  const notes =
    nullableText(
      confirmationData.notes,
    );

  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN",
    );

    const emergencyResult =
      await client.query(
        `
          SELECT
            emergency_case_id,
            hospital_id,
            patient_id,
            encounter_id,
            case_number,
            arrival_date,
            chief_complaint,
            initial_condition,
            unidentified_patient,
            status
          FROM public.emergency_cases
          WHERE
            emergency_case_id = $1
            AND hospital_id = $2
          FOR UPDATE;
        `,
        [
          emergencyCaseId,
          hospitalId,
        ],
      );

    if (
      emergencyResult.rowCount ===
      0
    ) {
      throw new Error(
        "Emergency case not found",
      );
    }

    const emergencyCase =
      emergencyResult.rows[0];

    if (
      emergencyCase.status ===
      "DISCHARGED"
    ) {
      throw new Error(
        "A discharged emergency case cannot be confirmed",
      );
    }

    if (
      emergencyCase.patient_id &&
      Number(
        emergencyCase.patient_id,
      ) !==
        patientId
    ) {
      throw new Error(
        "Emergency case is already linked to another patient",
      );
    }

    const patientResult =
      await client.query(
        `
          SELECT
            patient_id,
            patient_number,
            status,
            date_of_birth
          FROM public.patients
          WHERE
            patient_id = $1
            AND status = 'ACTIVE'
          FOR SHARE;
        `,
        [
          patientId,
        ],
      );

    if (
      patientResult.rowCount ===
      0
    ) {
      throw new Error(
        "Patient candidate was not found",
      );
    }

    const patient =
      patientResult.rows[0];

    const dob =
      new Date(
        patient.date_of_birth,
      );

    if (
      Number.isNaN(
        dob.getTime(),
      )
    ) {
      throw new Error(
        "Patient date of birth is invalid",
      );
    }

    const cutoff =
      new Date();

    cutoff.setFullYear(
      cutoff.getFullYear() -
        18,
    );

    if (
      dob > cutoff
    ) {
      throw new Error(
        "ECIS identity confirmation is restricted to adults",
      );
    }

    const reviewerResult =
      await client.query(
        `
          SELECT
            u.user_id,
            a.hospital_id,
            u.full_name,
            a.role,
            u.is_active
          FROM public.hospital_users u
          INNER JOIN public.hospital_user_assignments a
            ON a.user_id = u.user_id
          WHERE
            u.user_id = $1
            AND a.hospital_id = $2
            AND a.status = 'ACTIVE'
            AND a.start_date <= CURRENT_DATE
            AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
          LIMIT 1
          FOR SHARE OF u, a;
        `,
        [
          reviewerUserId,
          hospitalId,
        ],
      );

    if (
      reviewerResult.rowCount ===
        0 ||
      !reviewerResult.rows[0]
        .is_active
    ) {
      throw new Error(
        "Reviewer was not found",
      );
    }

    const reviewer =
      reviewerResult.rows[0];

    const role =
      String(
        reviewer.role ||
          "",
      )
        .trim()
        .toUpperCase();

    if (
      ![
        "DOCTOR",
        "ADMIN",
      ].includes(role) &&
      !hasLocalSystemAdminAccess(role)
    ) {
      throw new Error(
        "Reviewer is not authorized to confirm identity",
      );
    }

    const reviewResult =
      await client.query(
        `
          SELECT
            review_id,
            patient_id,
            review_status,
            reviewed_at
          FROM public.ecis_candidate_reviews
          WHERE
            emergency_case_id = $1

            AND patient_id = $2

            AND review_status = 'CONFIRMED'
          ORDER BY
            reviewed_at DESC,
            review_id DESC
          LIMIT 1;
        `,
        [
          emergencyCaseId,
          patientId,
        ],
      );

    const confirmedReview = reviewResult.rows[0] || null;

    if (
      !confirmedReview
    ) {
      throw new Error(
        "Identity confirmation requires a previous CONFIRMED candidate review",
      );
    }

    if (!emergencyCase.unidentified_patient) {
      throw new Error("Emergency case identity has already been confirmed");
    }

    await client.query(
      `
        INSERT INTO public.patient_hospital_registrations (
          patient_id, hospital_id, hospital_patient_number,
          status, registered_by, registered_at, updated_at
        )
        VALUES ($1, $2, $3, 'ACTIVE', $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (patient_id, hospital_id)
        DO UPDATE SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP;
      `,
      [patientId, hospitalId, patient.patient_number, reviewerUserId],
    );

    let encounterId = emergencyCase.encounter_id;
    if (encounterId) {
      const linkedEncounter = await client.query(
        `SELECT encounter_id FROM public.encounters
          WHERE encounter_id = $1 AND patient_id = $2 AND hospital_id = $3
          FOR UPDATE;`,
        [encounterId, patientId, hospitalId],
      );
      if (linkedEncounter.rowCount === 0) {
        throw new Error("Emergency case encounter does not match the confirmed patient and hospital");
      }
    } else {
      const encounterResult = await client.query(
        `INSERT INTO public.encounters (
           patient_id, hospital_id, encounter_type, encounter_date,
           department, status, chief_complaint, notes
         ) VALUES (
           $1, $2, 'EMERGENCY', $3, 'Emergency Department',
           'OPEN', $4, $5
         ) RETURNING encounter_id;`,
        [
          patientId,
          hospitalId,
          emergencyCase.arrival_date,
          emergencyCase.chief_complaint,
          emergencyCase.initial_condition,
        ],
      );
      encounterId = encounterResult.rows[0].encounter_id;
    }

    const updateResult =
      await client.query(
        `
          UPDATE public.emergency_cases
          SET
            patient_id = $1,
            encounter_id = $5,

            unidentified_patient =
              FALSE,

            status =
              CASE
                WHEN status = 'IDENTIFICATION_PENDING'
                  THEN 'IDENTIFIED'

                ELSE status
              END,

            identified_at =
              CURRENT_TIMESTAMP,

            identified_by =
              $2,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            emergency_case_id = $3
            AND hospital_id = $4

          RETURNING *;
        `,
        [
          patientId,
          reviewerUserId,
          emergencyCaseId,
          hospitalId,
          encounterId,
        ],
      );

    if (
      updateResult.rowCount ===
      0
    ) {
      throw new Error(
        "Emergency case could not be updated",
      );
    }

    await client.query(
      `
        INSERT INTO public.audit_logs (
          hospital_id, user_id, action_type, entity_type,
          entity_id, old_values, new_values, action_reason
        ) VALUES ($1, $2, 'IDENTITY_CONFIRMED', 'emergency_case',
          $3, $4::jsonb, $5::jsonb, $6);
      `,
      [
        hospitalId,
        reviewerUserId,
        emergencyCaseId,
        JSON.stringify(emergencyCase),
        JSON.stringify(updateResult.rows[0]),
        notes,
      ],
    );

    await client.query(
      "COMMIT",
    );

    return {
      emergencyCase:
        updateResult.rows[0],

      reviewer: {
        userId:
          reviewer.user_id,

        fullName:
          reviewer.full_name,

        role:
          reviewer.role,
      },

      review:
        confirmedReview,
    };
  } catch (
    error
  ) {
    await client.query(
      "ROLLBACK",
    );

    throw error;
  } finally {
    client.release();
  }
}


module.exports = {
  confirmIdentity,
};
