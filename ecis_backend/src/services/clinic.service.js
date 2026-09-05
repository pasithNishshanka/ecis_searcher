const pool = require("../config/database");

async function createClinic(clinicData) {
  const { hospitalId, clinicCode, clinicName, specialty, location } =
    clinicData;

  const query = `
    INSERT INTO clinics (
      hospital_id,
      clinic_code,
      clinic_name,
      specialty,
      location
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5
    )
    RETURNING *;
  `;

  const values = [
    hospitalId,
    clinicCode,
    clinicName,
    specialty || null,
    location || null,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}

async function getClinicsByHospital(hospitalId) {
  const query = `
    SELECT
      clinic_id,
      hospital_id,
      clinic_code,
      clinic_name,
      specialty,
      location,
      is_active,

      created_at,
      updated_at

    FROM clinics

    WHERE
      hospital_id = $1
      AND is_active = TRUE

    ORDER BY clinic_name ASC;
  `;

  const result = await pool.query(query, [hospitalId]);

  return result.rows;
}

async function createClinicVisit(visitData) {
  const {
    clinicId,
    patientId,
    hospitalId,
    visitNumber,
    visitDate,
    doctorUserId,
    reasonForVisit,
    clinicalNotes,
    diagnosisSummary,
    followUpRequired,
    followUpDate,
  } = visitData;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify clinic belongs to hospital
    const clinicResult = await client.query(
      `
        SELECT
          clinic_id,
          hospital_id,
          clinic_name,
          specialty
        FROM clinics
        WHERE
          clinic_id = $1
          AND hospital_id = $2
          AND is_active = TRUE
        FOR SHARE;
      `,
      [clinicId, hospitalId],
    );

    if (clinicResult.rowCount === 0) {
      throw new Error("Clinic not found for selected hospital");
    }

    // Verify patient exists
    const patientResult = await client.query(
      `
        SELECT
          patient_id,
          hospital_id,
          patient_number
        FROM patients
        WHERE
          patient_id = $1
          AND status = 'ACTIVE'
        FOR SHARE;
      `,
      [patientId],
    );

    if (patientResult.rowCount === 0) {
      throw new Error("Active patient not found");
    }

    // Create encounter
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
          'CLINIC',
          COALESCE($3::timestamp, CURRENT_TIMESTAMP),
          $4,
          'COMPLETED',
          $5,
          $6
        )
        RETURNING encounter_id;
      `,
      [
        patientId,
        hospitalId,
        visitDate || null,
        clinicResult.rows[0].specialty || null,
        reasonForVisit || null,
        clinicalNotes || null,
      ],
    );

    const encounterId = encounterResult.rows[0].encounter_id;

    // Create clinic visit
    const visitResult = await client.query(
      `
        INSERT INTO clinic_visits (
          clinic_id,
          encounter_id,
          patient_id,
          visit_number,
          visit_date,
          doctor_user_id,
          reason_for_visit,
          clinical_notes,
          diagnosis_summary,
          follow_up_required,
          follow_up_date,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          COALESCE($5::timestamp, CURRENT_TIMESTAMP),
          $6,
          $7,
          $8,
          $9,
          COALESCE($10, FALSE),
          $11,
          'COMPLETED'
        )
        RETURNING *;
      `,
      [
        clinicId,
        encounterId,
        patientId,
        visitNumber || null,
        visitDate || null,
        doctorUserId || null,
        reasonForVisit || null,
        clinicalNotes || null,
        diagnosisSummary || null,
        followUpRequired,
        followUpDate || null,
      ],
    );

    await client.query("COMMIT");

    return {
      encounterId,
      clinicVisit: visitResult.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getPatientClinicHistory(patientId) {
  const query = `
    SELECT
      cv.clinic_visit_id,
      cv.visit_number,
      cv.visit_date,

      cv.reason_for_visit,
      cv.clinical_notes,
      cv.diagnosis_summary,

      cv.follow_up_required,
      cv.follow_up_date,

      cv.status,

      c.clinic_id,
      c.clinic_code,
      c.clinic_name,
      c.specialty,

      e.encounter_id,
      e.encounter_type,

      u.user_id AS doctor_id,
      u.full_name AS doctor_name,

      h.hospital_id,
      h.hospital_name

    FROM clinic_visits cv

    INNER JOIN clinics c
      ON cv.clinic_id = c.clinic_id

    INNER JOIN encounters e
      ON cv.encounter_id = e.encounter_id

    LEFT JOIN hospital_users u
      ON cv.doctor_user_id = u.user_id

    INNER JOIN hospitals h
      ON c.hospital_id = h.hospital_id

    WHERE cv.patient_id = $1

    ORDER BY cv.visit_date DESC;
  `;

  const result = await pool.query(query, [patientId]);

  return result.rows;
}

module.exports = {
  createClinic,
  getClinicsByHospital,
  createClinicVisit,
  getPatientClinicHistory,
};
