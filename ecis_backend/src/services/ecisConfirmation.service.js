const pool = require("../config/database");

const confirmIdentity = async ({
  emergencyCaseId,
  patientId,
  reviewedBy,
  reviewReason,
}) => {
  const client = await pool.connect();

  try {
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
    // 2. Case must still be awaiting identification
    // ----------------------------------------------------

    if (!emergencyCase.unidentified_patient) {
      throw new Error("This emergency case is already identified");
    }

    if (emergencyCase.status !== "IDENTIFICATION_PENDING") {
      throw new Error(
        `Emergency case cannot be confirmed from status ${emergencyCase.status}`,
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

    if (emergencyCase.hospital_id !== patient.hospital_id) {
      throw new Error(
        "Emergency case and patient belong to different hospitals",
      );
    }

    if (emergencyCase.hospital_id !== reviewer.hospital_id) {
      throw new Error(
        "Reviewer does not belong to the emergency case hospital",
      );
    }

    // ----------------------------------------------------
    // 6. Check existing confirmed/review record
    // ----------------------------------------------------

    const existingReviewResult = await client.query(
      `
            SELECT
                review_id,
                review_status
            FROM public.ecis_candidate_reviews
            WHERE emergency_case_id = $1
              AND patient_id = $2
            ORDER BY reviewed_at DESC
            LIMIT 1
            `,
      [emergencyCaseId, patientId],
    );

    if (
      existingReviewResult.rows.length > 0 &&
      existingReviewResult.rows[0].review_status === "CONFIRMED"
    ) {
      throw new Error("This candidate has already been confirmed");
    }

    // ----------------------------------------------------
    // 7. Record confirmation review
    // ----------------------------------------------------

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
      [emergencyCaseId, patientId, reviewedBy, reviewReason.trim()],
    );

    // ----------------------------------------------------
    // 8. Update emergency case
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
      [patientId, reviewedBy, emergencyCaseId],
    );

    // ----------------------------------------------------
    // 9. Create audit record
    // ----------------------------------------------------

    // await client.query(
    //   `
    //         INSERT INTO public.audit_logs (
    //             hospital_id,
    //             user_id,
    //             action_type,
    //             entity_type,
    //             entity_id,
    //             old_values,
    //             new_values,
    //             action_reason
    //         )
    //         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    //         `,
    //   [
    //     emergencyCase.hospital_id,
    //     reviewedBy,
    //     "ECIS_IDENTITY_CONFIRMED",
    //     "emergency_case",
    //     emergencyCaseId,

    //     JSON.stringify({
    //       patient_id: emergencyCase.patient_id,
    //       unidentified_patient: emergencyCase.unidentified_patient,
    //       status: emergencyCase.status,
    //       identified_at: emergencyCase.identified_at,
    //       identified_by: emergencyCase.identified_by,
    //     }),

    //     JSON.stringify({
    //       patient_id: patientId,
    //       unidentified_patient: false,
    //       status: "IDENTIFIED",
    //     }),

    //     reviewReason.trim(),
    //   ],
    // );

    await client.query("COMMIT");

    return {
      review: reviewResult.rows[0],
      emergencyCase: updatedCaseResult.rows[0],
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
