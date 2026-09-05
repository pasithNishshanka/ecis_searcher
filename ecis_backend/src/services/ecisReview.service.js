const pool = require("../config/database");

const VALID_STATUSES = ["REJECTED", "NEEDS_MORE_EVIDENCE"];

const reviewCandidate = async ({
  emergencyCaseId,
  patientId,
  reviewedBy,
  reviewStatus,
  reviewReason,
}) => {
  /*
   * ---------------------------------------------------------
   * 1. VALIDATE REVIEW STATUS
   * ---------------------------------------------------------
   */

  if (!VALID_STATUSES.includes(reviewStatus)) {
    throw new Error(
      "Invalid review status. Allowed values: CONFIRMED, REJECTED, NEEDS_MORE_EVIDENCE",
    );
  }

  /*
   * ---------------------------------------------------------
   * 2. VALIDATE REQUIRED VALUES
   * ---------------------------------------------------------
   */

  if (!emergencyCaseId) {
    throw new Error("emergencyCaseId is required");
  }

  if (!patientId) {
    throw new Error("patientId is required");
  }

  if (!reviewedBy) {
    throw new Error("reviewedBy is required");
  }

  /*
   * A confirmed or rejected decision should have
   * an explanation for auditability.
   */

  if (
    (reviewStatus === "CONFIRMED" || reviewStatus === "REJECTED") &&
    (!reviewReason || !reviewReason.trim())
  ) {
    throw new Error(
      "reviewReason is required for CONFIRMED or REJECTED decisions",
    );
  }

  /*
   * ---------------------------------------------------------
   * 3. VERIFY EMERGENCY CASE
   * ---------------------------------------------------------
   */

  const emergencyCaseResult = await pool.query(
    `
        SELECT
            emergency_case_id,
            hospital_id,
            patient_id,
            case_number,
            status
        FROM public.emergency_cases
        WHERE emergency_case_id = $1
        `,
    [emergencyCaseId],
  );

  if (emergencyCaseResult.rows.length === 0) {
    throw new Error("Emergency case not found");
  }

  const emergencyCase = emergencyCaseResult.rows[0];

  /*
   * ---------------------------------------------------------
   * 4. VERIFY PATIENT
   * ---------------------------------------------------------
   */

  const patientResult = await pool.query(
    `
        SELECT
            patient_id,
            hospital_id,
            patient_number,
            first_name,
            middle_name,
            last_name,
            status
        FROM public.patients
        WHERE patient_id = $1
        `,
    [patientId],
  );

  if (patientResult.rows.length === 0) {
    throw new Error("Patient not found");
  }

  const patient = patientResult.rows[0];

  /*
   * ---------------------------------------------------------
   * 5. VERIFY REVIEWER
   * ---------------------------------------------------------
   */

  const reviewerResult = await pool.query(
    `
        SELECT
            user_id,
            hospital_id,
            full_name,
            username
        FROM public.hospital_users
        WHERE user_id = $1
        `,
    [reviewedBy],
  );

  if (reviewerResult.rows.length === 0) {
    throw new Error("Reviewer not found");
  }

  const reviewer = reviewerResult.rows[0];

  /*
   * ---------------------------------------------------------
   * 6. HOSPITAL CONSISTENCY CHECK
   * ---------------------------------------------------------
   *
   * The emergency case, patient and reviewer should belong
   * to the same hospital in this development architecture.
   */

  if (emergencyCase.hospital_id !== patient.hospital_id) {
    throw new Error("Emergency case and patient belong to different hospitals");
  }

  if (emergencyCase.hospital_id !== reviewer.hospital_id) {
    throw new Error("Reviewer does not belong to the emergency case hospital");
  }

  /*
   * ---------------------------------------------------------
   * 7. HANDLE EXISTING REVIEW FOR SAME CASE + PATIENT
   * ---------------------------------------------------------
   */

  const existingReviewResult = await pool.query(
    `
        SELECT
            review_id,
            review_status,
            review_reason,
            reviewed_by,
            reviewed_at
        FROM public.ecis_candidate_reviews
        WHERE emergency_case_id = $1
          AND patient_id = $2
        ORDER BY reviewed_at DESC
        LIMIT 1
        `,
    [emergencyCaseId, patientId],
  );

  if (existingReviewResult.rows.length > 0) {
    const existingReview = existingReviewResult.rows[0];

    /*
     * A candidate should not be silently changed from one
     * decision to another. Record a new review only when
     * explicitly requested in a future revision workflow.
     */

    throw new Error(
      `A review already exists for this candidate with status ${existingReview.review_status}`,
    );
  }

  /*
   * ---------------------------------------------------------
   * 8. INSERT REVIEW
   * ---------------------------------------------------------
   */

  const insertResult = await pool.query(
    `
        INSERT INTO public.ecis_candidate_reviews (
            emergency_case_id,
            patient_id,
            reviewed_by,
            review_status,
            review_reason
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
            review_id,
            emergency_case_id,
            patient_id,
            reviewed_by,
            review_status,
            review_reason,
            reviewed_at
        `,
    [
      emergencyCaseId,
      patientId,
      reviewedBy,
      reviewStatus,
      reviewReason ? reviewReason.trim() : null,
    ],
  );

  return {
    review: insertResult.rows[0],
    emergencyCase,
    patient,
    reviewer,
  };
};

const getReviewsByEmergencyCase = async (emergencyCaseId) => {
  const result = await pool.query(
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
            ON p.patient_id = r.patient_id

        INNER JOIN public.hospital_users u
            ON u.user_id = r.reviewed_by

        WHERE r.emergency_case_id = $1

        ORDER BY r.reviewed_at DESC
        `,
    [emergencyCaseId],
  );

  return result.rows;
};

const getReviewById = async (reviewId) => {
  const result = await pool.query(
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
            ON p.patient_id = r.patient_id

        INNER JOIN public.hospital_users u
            ON u.user_id = r.reviewed_by

        WHERE r.review_id = $1
        `,
    [reviewId],
  );

  return result.rows[0] || null;
};

module.exports = {
  reviewCandidate,
  getReviewsByEmergencyCase,
  getReviewById,
};
