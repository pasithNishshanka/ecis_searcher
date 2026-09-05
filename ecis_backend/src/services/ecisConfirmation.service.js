const pool = require("../config/database");

const confirmIdentity = async ({
  emergencyCaseId,
  patientId,
  reviewedBy,
  reviewReason,
}) => {
  const client = await pool.connect();

  try {
    // ----------------------------------------------------
    // 0. Basic validation
    // ----------------------------------------------------

    if (!emergencyCaseId) {
      throw new Error("emergencyCaseId is required");
    }

    if (!patientId) {
      throw new Error("patientId is required");
    }

    if (!reviewedBy) {
      throw new Error("reviewedBy is required");
    }

    if (!reviewReason || !reviewReason.trim()) {
      throw new Error("reviewReason is required");
    }

    await client.query("BEGIN");

    // ----------------------------------------------------
    // 1. Get and lock the emergency case
    // ----------------------------------------------------

    const emergencyCaseResult = await client.query(
      `
      SELECT
        emergency_case_id,
        hospital_id,
        encounter_id,
        patient_id,
        case_number,
        unidentified_patient,
        status,
        identified_at,
        identified_by
      FROM public.emergency_cases
      WHERE emergency_case_id = $1
      FOR UPDATE
      `,
      [emergencyCaseId],
    );

    if (emergencyCaseResult.rows.length === 0) {
      throw new Error("Emergency case not found");
    }

    const emergencyCase = emergencyCaseResult.rows[0];

    // ----------------------------------------------------
    // 2. Check current identity state
    // ----------------------------------------------------

    /*
     * If the case is already identified, do not identify it
     * again through this endpoint.
     */
    if (!emergencyCase.unidentified_patient) {
      throw new Error(
        "This emergency case is already identified",
      );
    }

    /*
     * ECIS confirmation is allowed while the patient is:
     *
     * IN_TREATMENT
     * or
     * IDENTIFICATION_PENDING
     */
    const allowedStatusesForIdentification = [
      "IN_TREATMENT",
      "IDENTIFICATION_PENDING",
    ];

    if (
      !allowedStatusesForIdentification.includes(
        emergencyCase.status,
      )
    ) {
      throw new Error(
        `Emergency case cannot be confirmed from status ${emergencyCase.status}`,
      );
    }

    /*
     * Protect against inconsistent data where the case is
     * marked unidentified but already has another patient_id.
     */
    if (
      emergencyCase.patient_id !== null &&
      Number(emergencyCase.patient_id) !== Number(patientId)
    ) {
      throw new Error(
        "Emergency case is already associated with a different patient",
      );
    }

    // ----------------------------------------------------
    // 3. Get patient
    // ----------------------------------------------------

    const patientResult = await client.query(
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

    // ----------------------------------------------------
    // 4. Get reviewer
    // ----------------------------------------------------

    const reviewerResult = await client.query(
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

    // ----------------------------------------------------
    // 5. Hospital consistency
    // ----------------------------------------------------

    if (
      Number(emergencyCase.hospital_id) !==
      Number(patient.hospital_id)
    ) {
      throw new Error(
        "Emergency case and patient belong to different hospitals",
      );
    }

    if (
      Number(emergencyCase.hospital_id) !==
      Number(reviewer.hospital_id)
    ) {
      throw new Error(
        "Reviewer does not belong to the emergency case hospital",
      );
    }

    // ----------------------------------------------------
    // 6. Find existing review for this candidate
    // ----------------------------------------------------

    const existingReviewResult = await client.query(
      `
      SELECT
        review_id,
        emergency_case_id,
        patient_id,
        reviewed_by,
        review_status,
        review_reason,
        reviewed_at
      FROM public.ecis_candidate_reviews
      WHERE emergency_case_id = $1
        AND patient_id = $2
      ORDER BY reviewed_at DESC
      LIMIT 1
      `,
      [emergencyCaseId, patientId],
    );

    let review;

    // ----------------------------------------------------
    // 7. Handle existing CONFIRMED review
    // ----------------------------------------------------

    if (
      existingReviewResult.rows.length > 0 &&
      existingReviewResult.rows[0].review_status ===
        "CONFIRMED"
    ) {
      /*
       * A previous request created the CONFIRMED review,
       * but the emergency case was not completed.
       *
       * Reuse the existing confirmation instead of creating
       * a duplicate review.
       */
      review = existingReviewResult.rows[0];
    } else {
      // --------------------------------------------------
      // 8. Create confirmation review
      // --------------------------------------------------

      const reviewResult = await client.query(
        `
        INSERT INTO public.ecis_candidate_reviews (
          emergency_case_id,
          patient_id,
          reviewed_by,
          review_status,
          review_reason
        )
        VALUES ($1, $2, $3, 'CONFIRMED', $4)
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
          reviewReason.trim(),
        ],
      );

      review = reviewResult.rows[0];
    }

    // ----------------------------------------------------
    // 9. Update emergency case
    // ----------------------------------------------------

    const updatedCaseResult = await client.query(
      `
      UPDATE public.emergency_cases
      SET
        patient_id = $1,
        unidentified_patient = FALSE,
        status = 'IDENTIFIED',
        identified_at = CURRENT_TIMESTAMP,
        identified_by = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE emergency_case_id = $3
      RETURNING *
      `,
      [
        patientId,
        reviewedBy,
        emergencyCaseId,
      ],
    );

    if (updatedCaseResult.rows.length === 0) {
      throw new Error(
        "Failed to update emergency case",
      );
    }

    const updatedEmergencyCase =
      updatedCaseResult.rows[0];

    // ----------------------------------------------------
    // 10. COMMIT
    // ----------------------------------------------------

    /*
     * The UPDATE above automatically fires the PostgreSQL
     * audit trigger.
     *
     * We therefore DO NOT manually insert into audit_logs.
     */
    await client.query("COMMIT");

    // ----------------------------------------------------
    // 11. Return result
    // ----------------------------------------------------

    return {
      review,
      emergencyCase: updatedEmergencyCase,
      patient,
      reviewer,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  confirmIdentity,
};