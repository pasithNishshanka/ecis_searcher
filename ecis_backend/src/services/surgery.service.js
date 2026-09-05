const pool = require('../config/database');


async function createSurgery(surgeryData) {
  const {
    patientId,
    encounterId,
    admissionId,
    surgeryCode,
    surgeryName,
    surgeryDate,
    bodySite,
    laterality,
    surgeonUserId,
    preoperativeDiagnosis,
    postoperativeDiagnosis,
    findings,
    complications,
    surgicalNotes,
  } = surgeryData;

  const query = `
    INSERT INTO surgeries (
      patient_id,
      encounter_id,
      admission_id,
      surgery_code,
      surgery_name,
      surgery_date,
      body_site,
      laterality,
      surgeon_user_id,
      preoperative_diagnosis,
      postoperative_diagnosis,
      findings,
      complications,
      surgical_notes
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
      $10,
      $11,
      $12,
      $13,
      $14
    )
    RETURNING *;
  `;

  const values = [
    patientId,
    encounterId,
    admissionId || null,
    surgeryCode || null,
    surgeryName,
    surgeryDate || null,
    bodySite || null,
    laterality || null,
    surgeonUserId || null,
    preoperativeDiagnosis || null,
    postoperativeDiagnosis || null,
    findings || null,
    complications || null,
    surgicalNotes || null,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}


async function getPatientSurgeries(patientId) {
  const query = `
    SELECT
      s.surgery_id,
      s.surgery_code,
      s.surgery_name,
      s.surgery_date,

      s.body_site,
      s.laterality,

      s.preoperative_diagnosis,
      s.postoperative_diagnosis,

      s.findings,
      s.complications,
      s.surgical_notes,

      s.encounter_id,
      s.admission_id,

      u.user_id AS surgeon_id,
      u.full_name AS surgeon_name

    FROM surgeries s

    LEFT JOIN hospital_users u
      ON s.surgeon_user_id = u.user_id

    WHERE s.patient_id = $1

    ORDER BY s.surgery_date DESC;
  `;

  const result = await pool.query(query, [patientId]);

  return result.rows;
}


async function getSurgeryById(surgeryId) {
  const query = `
    SELECT
      s.*,

      p.patient_number,
      p.first_name,
      p.last_name,

      u.full_name AS surgeon_name

    FROM surgeries s

    INNER JOIN patients p
      ON s.patient_id = p.patient_id

    LEFT JOIN hospital_users u
      ON s.surgeon_user_id = u.user_id

    WHERE s.surgery_id = $1;
  `;

  const result = await pool.query(query, [surgeryId]);

  return result.rows[0] || null;
}


module.exports = {
  createSurgery,
  getPatientSurgeries,
  getSurgeryById,
};