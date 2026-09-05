const pool = require("../config/database");

/**
 * Create a ward admission and assign a bed.
 *
 * The following operations are treated as one transaction:
 *
 * 1. Validate patient
 * 2. Lock and validate bed
 * 3. Create encounter
 * 4. Create admission
 * 5. Mark bed as occupied
 *
 * If one operation fails, everything is rolled back.
 */
async function createAdmission(admissionData) {
  const {
    patientId,
    hospitalId,
    wardId,
    bedId,
    admissionNumber,
    admissionDate,
    admissionReason,
    admissionDiagnosis,
    attendingDoctorId,
  } = admissionData;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // --------------------------------------------------
    // 1. Verify patient exists and belongs to hospital
    // --------------------------------------------------

    const patientResult = await client.query(
      `
        SELECT
          patient_id,
          hospital_id,
          patient_number,
          first_name,
          last_name
        FROM patients
        WHERE
          patient_id = $1
          AND hospital_id = $2
          AND status = 'ACTIVE'
        FOR SHARE;
      `,
      [patientId, hospitalId],
    );

    if (patientResult.rowCount === 0) {
      throw new Error("Active patient not found for the selected hospital");
    }

    // --------------------------------------------------
    // 2. Verify ward belongs to hospital
    // --------------------------------------------------

    const wardResult = await client.query(
      `
        SELECT
          ward_id,
          hospital_id,
          ward_name,
          capacity,
          is_active
        FROM wards
        WHERE
          ward_id = $1
          AND hospital_id = $2
          AND is_active = TRUE
        FOR SHARE;
      `,
      [wardId, hospitalId],
    );

    if (wardResult.rowCount === 0) {
      throw new Error("Active ward not found for the selected hospital");
    }

    // --------------------------------------------------
    // 3. Lock the selected bed
    // --------------------------------------------------
    // FOR UPDATE prevents another transaction from
    // changing/assigning the same bed simultaneously.

    const bedResult = await client.query(
      `
        SELECT
          bed_id,
          ward_id,
          bed_number,
          status
        FROM beds
        WHERE
          bed_id = $1
          AND ward_id = $2
        FOR UPDATE;
      `,
      [bedId, wardId],
    );

    if (bedResult.rowCount === 0) {
      throw new Error("Selected bed does not belong to the selected ward");
    }

    const bed = bedResult.rows[0];

    if (bed.status !== "AVAILABLE") {
      throw new Error(
        `Selected bed is not available. Current status: ${bed.status}`,
      );
    }

    // --------------------------------------------------
    // 4. Check that patient doesn't already have
    //    an active admission
    // --------------------------------------------------

    const activeAdmissionResult = await client.query(
      `
        SELECT admission_id
        FROM admissions
        WHERE
          patient_id = $1
          AND status = 'ADMITTED'
        LIMIT 1;
      `,
      [patientId],
    );

    if (activeAdmissionResult.rowCount > 0) {
      throw new Error("Patient already has an active admission");
    }

    // --------------------------------------------------
    // 5. Create ward encounter
    // --------------------------------------------------

    const encounterResult = await client.query(
      `
        INSERT INTO encounters (
          patient_id,
          hospital_id,
          encounter_type,
          encounter_date,
          department,
          status,
          chief_complaint,
          notes
        )
        VALUES (
          $1,
          $2,
          'WARD',
          COALESCE($3::timestamp, CURRENT_TIMESTAMP),
          'Ward',
          'OPEN',
          $4,
          $5
        )
        RETURNING encounter_id;
      `,
      [
        patientId,
        hospitalId,
        admissionDate || null,
        admissionReason || null,
        admissionDiagnosis || null,
      ],
    );

    const encounterId = encounterResult.rows[0].encounter_id;

    // --------------------------------------------------
    // 6. Create admission
    // --------------------------------------------------

    const admissionResult = await client.query(
      `
        INSERT INTO admissions (
          patient_id,
          encounter_id,
          ward_id,
          bed_id,
          admission_number,
          admission_date,
          admission_reason,
          admission_diagnosis,
          attending_doctor_id,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          COALESCE($6::timestamp, CURRENT_TIMESTAMP),
          $7,
          $8,
          $9,
          'ADMITTED'
        )
        RETURNING *;
      `,
      [
        patientId,
        encounterId,
        wardId,
        bedId,
        admissionNumber,
        admissionDate || null,
        admissionReason || null,
        admissionDiagnosis || null,
        attendingDoctorId || null,
      ],
    );

    const admission = admissionResult.rows[0];

    // --------------------------------------------------
    // 7. Mark bed occupied
    // --------------------------------------------------

    await client.query(
      `
        UPDATE beds
        SET
          status = 'OCCUPIED',
          updated_at = CURRENT_TIMESTAMP
        WHERE bed_id = $1;
      `,
      [bedId],
    );

    // --------------------------------------------------
    // 8. Commit
    // --------------------------------------------------

    await client.query("COMMIT");

    return {
      encounterId,
      admission,
      bed: {
        bedId: bed.bed_id,
        bedNumber: bed.bed_number,
        status: "OCCUPIED",
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get all admissions for a patient.
 */
async function getPatientAdmissions(patientId) {
  const query = `
    SELECT
      a.admission_id,
      a.admission_number,

      a.admission_date,
      a.discharge_date,

      a.admission_reason,
      a.admission_diagnosis,

      a.discharge_diagnosis,
      a.discharge_summary,

      a.status,

      e.encounter_id,
      e.encounter_type,

      w.ward_id,
      w.ward_code,
      w.ward_name,

      b.bed_id,
      b.bed_number,

      u.user_id AS doctor_id,
      u.full_name AS doctor_name,

      h.hospital_id,
      h.hospital_name

    FROM admissions a

    INNER JOIN encounters e
      ON a.encounter_id = e.encounter_id

    INNER JOIN wards w
      ON a.ward_id = w.ward_id

    INNER JOIN beds b
      ON a.bed_id = b.bed_id

    LEFT JOIN hospital_users u
      ON a.attending_doctor_id = u.user_id

    INNER JOIN hospitals h
      ON w.hospital_id = h.hospital_id

    WHERE a.patient_id = $1

    ORDER BY a.admission_date DESC;
  `;

  const result = await pool.query(query, [patientId]);

  return result.rows;
}

/**
 * Get one admission.
 */
async function getAdmissionById(admissionId) {
  const query = `
    SELECT
      a.admission_id,
      a.admission_number,

      a.admission_date,
      a.discharge_date,

      a.admission_reason,
      a.admission_diagnosis,

      a.discharge_diagnosis,
      a.discharge_summary,

      a.status,

      p.patient_id,
      p.patient_number,
      p.first_name,
      p.last_name,

      w.ward_id,
      w.ward_name,

      b.bed_id,
      b.bed_number,

      u.user_id AS doctor_id,
      u.full_name AS doctor_name,

      h.hospital_name

    FROM admissions a

    INNER JOIN patients p
      ON a.patient_id = p.patient_id

    INNER JOIN wards w
      ON a.ward_id = w.ward_id

    INNER JOIN beds b
      ON a.bed_id = b.bed_id

    LEFT JOIN hospital_users u
      ON a.attending_doctor_id = u.user_id

    INNER JOIN hospitals h
      ON w.hospital_id = h.hospital_id

    WHERE a.admission_id = $1;
  `;

  const result = await pool.query(query, [admissionId]);

  return result.rows[0] || null;
}

module.exports = {
  createAdmission,
  getPatientAdmissions,
  getAdmissionById,
};
