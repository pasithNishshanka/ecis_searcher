const pool = require("../config/database");

const VALID_STATUSES = [
  "REJECTED",
  "NEEDS_MORE_EVIDENCE",
];

function positiveInteger(value, fieldName) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(
      `${fieldName} must be a positive integer`,
    );
  }

  return number;
}

async function reviewCandidate({
  emergencyCaseId: emergencyCaseIdValue,
  patientId: patientIdValue,
  reviewedBy: reviewedByValue,
  reviewStatus,
  reviewReason,
  hospitalId: hospitalIdValue,
}) {
  const emergencyCaseId =
    positiveInteger(
      emergencyCaseIdValue,
      "emergencyCaseId",
    );

  const patientId =
    positiveInteger(
      patientIdValue,
      "patientId",
    );

  const reviewedBy =
    positiveInteger(
      reviewedByValue,
      "reviewedBy",
    );

  const hospitalId =
    positiveInteger(
      hospitalIdValue,
      "hospitalId",
    );

  const normalizedStatus =
    String(
      reviewStatus || "",
    )
      .trim()
      .toUpperCase();

  if (
    !VALID_STATUSES.includes(
      normalizedStatus,
    )
  ) {
    throw new Error(
      "Invalid review status. Allowed values: REJECTED, NEEDS_MORE_EVIDENCE",
    );
  }

  const reason =
    String(
      reviewReason || "",
    ).trim();

  if (!reason) {
    throw new Error(
      "reviewReason is required for a candidate review",
    );
  }

  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN",
    );

    /*
     * --------------------------------------------------------
     * 1. Lock emergency case
     * --------------------------------------------------------
     */

    const emergencyCaseResult =
      await client.query(
        `
          SELECT
            emergency_case_id,
            hospital_id,
            patient_id,
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
      emergencyCaseResult.rowCount ===
      0
    ) {
      throw new Error(
        "Emergency case not found for the authenticated hospital",
      );
    }

    const emergencyCase =
      emergencyCaseResult.rows[0];

    /*
     * Candidate review is only meaningful
     * while the case is still unidentified.
     */

    if (
      !emergencyCase.unidentified_patient
    ) {
      throw new Error(
        "Candidate review is only available while the emergency case is unidentified",
      );
    }

    /*
     * --------------------------------------------------------
     * 2. Validate patient candidate
     * --------------------------------------------------------
     */

    const patientResult =
      await client.query(
        `
          SELECT
            patient_id,
            hospital_id,
            patient_number,
            first_name,
            middle_name,
            last_name,
            status,
            date_of_birth
          FROM public.patients
          WHERE
            patient_id = $1
            AND hospital_id = $2
            AND status = 'ACTIVE'
            AND date_of_birth <=
                CURRENT_DATE -
                INTERVAL '18 years'
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
        "Adult patient not found for the authenticated hospital",
      );
    }

    const patient =
      patientResult.rows[0];

    /*
     * --------------------------------------------------------
     * 3. Validate authenticated reviewer
     * --------------------------------------------------------
     */

    const reviewerResult =
      await client.query(
        `
          SELECT
            user_id,
            hospital_id,
            full_name,
            username,
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
          reviewedBy,
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
        "Authenticated reviewer was not found",
      );
    }

    const reviewer =
      reviewerResult.rows[0];

    if (
      String(
        reviewer.role || "",
      )
        .trim()
        .toUpperCase() !==
      "DOCTOR"
    ) {
      throw new Error(
        "Only an authenticated doctor can review an ECIS candidate",
      );
    }

    /*
     * --------------------------------------------------------
     * 4. Prevent review after confirmed identity
     * --------------------------------------------------------
     */

    const existingConfirmedResult =
      await client.query(
        `
          SELECT
            review_id,
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

    if (
      existingConfirmedResult.rowCount >
      0
    ) {
      throw new Error(
        "This candidate has already been confirmed for the emergency case",
      );
    }

    /*
     * --------------------------------------------------------
     * 5. Insert review
     *
     * Important:
     * ecis_candidate_reviews does NOT contain hospital_id.
     * Hospital ownership is validated through the related
     * emergency case, patient and reviewer.
     * --------------------------------------------------------
     */

    const insertResult =
      await client.query(
        `
          INSERT INTO public.ecis_candidate_reviews (
            emergency_case_id,
            patient_id,
            reviewed_by,
            review_status,
            review_reason
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5
          )
          RETURNING
            review_id,
            emergency_case_id,
            patient_id,
            reviewed_by,
            review_status,
            review_reason,
            reviewed_at;
        `,
        [
          emergencyCaseId,
          patientId,
          reviewedBy,
          normalizedStatus,
          reason,
        ],
      );

    await client.query(
      "COMMIT",
    );

    return {
      review:
        insertResult.rows[0],

      emergencyCase,

      patient,

      reviewer,
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

async function getReviewsByEmergencyCase(
  emergencyCaseIdValue,
  hospitalIdValue,
) {
  const emergencyCaseId =
    positiveInteger(
      emergencyCaseIdValue,
      "emergencyCaseId",
    );

  const hospitalId =
    positiveInteger(
      hospitalIdValue,
      "hospitalId",
    );

  const result =
    await pool.query(
      `
        SELECT
          r.review_id,
          r.emergency_case_id,
          r.patient_id,

          p.patient_number,
          p.first_name,
          p.middle_name,
          p.last_name,

          r.reviewed_by,
          u.full_name AS reviewer_name,

          r.review_status,
          r.review_reason,
          r.reviewed_at

        FROM public.ecis_candidate_reviews r

        INNER JOIN public.patients p
          ON p.patient_id =
             r.patient_id

        INNER JOIN public.hospital_users u
          ON u.user_id =
             r.reviewed_by

        INNER JOIN public.emergency_cases ec
          ON ec.emergency_case_id =
             r.emergency_case_id

        WHERE
          r.emergency_case_id = $1
          AND ec.hospital_id = $2
          AND p.hospital_id = $2
          AND u.hospital_id = $2

        ORDER BY
          r.reviewed_at DESC,
          r.review_id DESC;
      `,
      [
        emergencyCaseId,
        hospitalId,
      ],
    );

  return result.rows;
}

async function getReviewById(
  reviewIdValue,
  hospitalIdValue,
) {
  const reviewId =
    positiveInteger(
      reviewIdValue,
      "reviewId",
    );

  const hospitalId =
    positiveInteger(
      hospitalIdValue,
      "hospitalId",
    );

  const result =
    await pool.query(
      `
        SELECT
          r.review_id,
          r.emergency_case_id,
          r.patient_id,

          p.patient_number,
          p.first_name,
          p.middle_name,
          p.last_name,

          r.reviewed_by,
          u.full_name AS reviewer_name,

          r.review_status,
          r.review_reason,
          r.reviewed_at

        FROM public.ecis_candidate_reviews r

        INNER JOIN public.patients p
          ON p.patient_id =
             r.patient_id

        INNER JOIN public.hospital_users u
          ON u.user_id =
             r.reviewed_by

        INNER JOIN public.emergency_cases ec
          ON ec.emergency_case_id =
             r.emergency_case_id

        WHERE
          r.review_id = $1
          AND ec.hospital_id = $2
          AND p.hospital_id = $2
          AND u.hospital_id = $2

        LIMIT 1;
      `,
      [
        reviewId,
        hospitalId,
      ],
    );

  return (
    result.rows[0] ||
    null
  );
}

module.exports = {
  reviewCandidate,
  getReviewsByEmergencyCase,
  getReviewById,
};