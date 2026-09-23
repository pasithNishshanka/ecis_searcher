const pool =
  require("../config/database");


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
            hospital_id,
            status,
            date_of_birth
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

    if (
      patientResult.rowCount ===
      0
    ) {
      throw new Error(
        "Patient not found for the authenticated hospital",
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
            user_id,
            hospital_id,
            full_name,
            role,
            is_active
          FROM public.hospital_users
          WHERE
            user_id = $1
            AND hospital_id = $2
          LIMIT 1
          FOR SHARE;
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
      ].includes(
        role,
      )
    ) {
      throw new Error(
        "Reviewer is not authorized to confirm identity",
      );
    }

    const reviewResult =
      await client.query(
        `
          SELECT
            ecis_candidate_review_id,
            candidate_patient_id,
            decision,
            reviewed_at
          FROM public.ecis_candidate_reviews
          WHERE
            emergency_case_id = $1

            AND candidate_patient_id = $2

            AND decision = 'CONFIRM'

            AND hospital_id IS NOT NULL
          ORDER BY
            reviewed_at DESC,
            ecis_candidate_review_id DESC
          LIMIT 1;
        `,
        [
          emergencyCaseId,
          patientId,
        ],
      );

    /*
     * Existing installations may not yet expose hospital_id
     * on ecis_candidate_reviews. In that case the confirmation
     * must still require a previous review decision.
     */
    let confirmedReview = null;

    if (
      reviewResult.rows.length
    ) {
      confirmedReview =
        reviewResult.rows[0];
    } else {
      const fallbackReview =
        await client.query(
          `
            SELECT
              ecis_candidate_review_id,
              candidate_patient_id,
              decision,
              reviewed_at
            FROM public.ecis_candidate_reviews
            WHERE
              emergency_case_id = $1
              AND candidate_patient_id = $2
              AND decision = 'CONFIRM'
            ORDER BY
              reviewed_at DESC,
              ecis_candidate_review_id DESC
            LIMIT 1;
          `,
          [
            emergencyCaseId,
            patientId,
          ],
        );

      confirmedReview =
        fallbackReview.rows[0] ||
        null;
    }

    if (
      !confirmedReview
    ) {
      throw new Error(
        "Identity confirmation requires a previous CONFIRM candidate review",
      );
    }

    const updateResult =
      await client.query(
        `
          UPDATE public.emergency_cases
          SET
            patient_id = $1,

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

            identification_notes =
              COALESCE(
                $3,
                identification_notes
              ),

            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            emergency_case_id = $4
            AND hospital_id = $5

          RETURNING *;
        `,
        [
          patientId,
          reviewerUserId,
          notes,
          emergencyCaseId,
          hospitalId,
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