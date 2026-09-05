const pool = require("../config/database");

async function createOpdVisit(opdData) {
  const {
    patientId,
    hospitalId,
    opdNumber,
    doctorUserId,
    department,
    chiefComplaint,
    clinicalNotes,
    diagnosisSummary,
    followUpRequired,
    followUpDate,
  } = opdData;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Create encounter
    const encounterResult = await client.query(
      `
        INSERT INTO encounters (
          patient_id,
          hospital_id,
          encounter_type,
          department,
          status,
          chief_complaint,
          notes
        )
        VALUES (
          $1,
          $2,
          'OPD',
          $3,
          'COMPLETED',
          $4,
          $5
        )
        RETURNING encounter_id;
      `,
      [
        patientId,
        hospitalId,
        department || null,
        chiefComplaint || null,
        clinicalNotes || null,
      ],
    );

    const encounterId = encounterResult.rows[0].encounter_id;

    // 2. Create OPD visit
    const opdResult = await client.query(
      `
        INSERT INTO opd_visits (
          encounter_id,
          patient_id,
          opd_number,
          doctor_user_id,
          chief_complaint,
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
          $5,
          $6,
          $7,
          $8,
          $9,
          'COMPLETED'
        )
        RETURNING *;
      `,
      [
        encounterId,
        patientId,
        opdNumber,
        doctorUserId || null,
        chiefComplaint || null,
        clinicalNotes || null,
        diagnosisSummary || null,
        followUpRequired || false,
        followUpDate || null,
      ],
    );

    await client.query("COMMIT");

    return {
      encounterId,
      opdVisit: opdResult.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getPatientOpdHistory(patientId) {
  const result = await pool.query(
    `
      SELECT
        o.opd_visit_id,
        o.opd_number,

        o.visit_date,

        o.chief_complaint,
        o.clinical_notes,
        o.diagnosis_summary,

        o.follow_up_required,
        o.follow_up_date,

        o.status,

        e.encounter_id,
        e.department,

        h.hospital_id,
        h.hospital_name,

        u.user_id AS doctor_id,
        u.full_name AS doctor_name

      FROM opd_visits o

      INNER JOIN encounters e
        ON o.encounter_id = e.encounter_id

      INNER JOIN patients p
        ON o.patient_id = p.patient_id

      INNER JOIN hospitals h
        ON e.hospital_id = h.hospital_id

      LEFT JOIN hospital_users u
        ON o.doctor_user_id = u.user_id

      WHERE o.patient_id = $1

      ORDER BY o.visit_date DESC;
    `,
    [patientId],
  );

  return result.rows;
}

module.exports = {
  createOpdVisit,
  getPatientOpdHistory,
};
