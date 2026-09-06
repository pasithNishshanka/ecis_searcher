const pool = require("../config/database");

async function createTreatment(treatmentData) {
  const {
    patientId,
    encounterId,
    opdVisitId,
    clinicVisitId,
    admissionId,
    emergencyCaseId,
    treatmentDate,
    treatmentType,
    treatmentName,
    description,
    bodySite,
    laterality,
    performedBy,
    outcome,
    complications,
  } = treatmentData;

  const query = `
    INSERT INTO treatment_records (
      patient_id,
      encounter_id,
      opd_visit_id,
      clinic_visit_id,
      admission_id,
      emergency_case_id,
      treatment_date,
      treatment_type,
      treatment_name,
      description,
      body_site,
      laterality,
      performed_by,
      outcome,
      complications
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      COALESCE($7::timestamp, CURRENT_TIMESTAMP),
      $8,
      $9,
      $10,
      $11,
      $12,
      $13,
      $14,
      $15
    )
    RETURNING *;
  `;

  const values = [
    patientId,
    encounterId,
    opdVisitId || null,
    clinicVisitId || null,
    admissionId || null,
    emergencyCaseId || null,
    treatmentDate || null,
    treatmentType,
    treatmentName || null,
    description || null,
    bodySite || null,
    laterality || null,
    performedBy || null,
    outcome || null,
    complications || null,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}

async function getPatientTreatments(patientId) {
  const query = `
    SELECT
      t.treatment_id,
      t.treatment_date,
      t.treatment_type,
      t.treatment_name,
      t.description,
      t.body_site,
      t.laterality,
      t.outcome,
      t.complications,

      t.opd_visit_id,
      t.clinic_visit_id,
      t.admission_id,
      t.emergency_case_id,

      p.patient_number,

      u.user_id AS performed_by_id,
      u.full_name AS performed_by_name

    FROM treatment_records t

    INNER JOIN patients p
      ON t.patient_id = p.patient_id

    LEFT JOIN hospital_users u
      ON t.performed_by = u.user_id

    WHERE t.patient_id = $1

    ORDER BY t.treatment_date DESC;
  `;

  const result = await pool.query(query, [patientId]);

  return result.rows;
}

async function getTreatmentById(treatmentId) {
  const query = `
    SELECT
      t.*,

      p.patient_number,
      p.first_name,
      p.last_name,

      u.full_name AS performed_by_name

    FROM treatment_records t

    INNER JOIN patients p
      ON t.patient_id = p.patient_id

    LEFT JOIN hospital_users u
      ON t.performed_by = u.user_id

    WHERE t.treatment_id = $1;
  `;

  const result = await pool.query(query, [treatmentId]);

  return result.rows[0] || null;
}

async function getAllTreatments() {
  const query = `
    SELECT
      t.treatment_id,
      t.patient_id,
      t.encounter_id,
      t.opd_visit_id,
      t.clinic_visit_id,
      t.admission_id,
      t.emergency_case_id,
      t.treatment_date,
      t.treatment_type,
      t.treatment_name,
      t.description,
      t.body_site,
      t.laterality,
      t.performed_by,
      t.outcome,
      t.complications,

      p.patient_number,
      p.first_name,
      p.last_name,

      u.full_name AS performed_by_name

    FROM public.treatment_records t

    INNER JOIN public.patients p
      ON t.patient_id = p.patient_id

    LEFT JOIN public.hospital_users u
      ON t.performed_by = u.user_id

    WHERE p.hospital_id = $1

    ORDER BY t.treatment_date DESC;
  `;

  const result = await pool.query(query, [1]);

  return result.rows;
}

module.exports = {
  createTreatment,
  getAllTreatments,
  getPatientTreatments,
  getTreatmentById,
};
