const pool = require('../config/database');


async function createCondition(conditionData) {
  const {
    conditionCode,
    conditionName,
    description,
  } = conditionData;

  const query = `
    INSERT INTO medical_conditions (
      condition_code,
      condition_name,
      description
    )
    VALUES (
      $1,
      $2,
      $3
    )
    RETURNING *;
  `;

  const values = [
    conditionCode || null,
    conditionName,
    description || null,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}


async function getAllConditions() {
  const query = `
    SELECT
      condition_id,
      condition_code,
      condition_name,
      description,
      created_at
    FROM medical_conditions
    ORDER BY condition_name ASC;
  `;

  const result = await pool.query(query);

  return result.rows;
}


async function addPatientCondition(patientConditionData) {
  const {
    patientId,
    conditionId,
    encounterId,
    diagnosisDate,
    conditionStatus,
    severity,
    notes,
  } = patientConditionData;

  const query = `
    INSERT INTO patient_conditions (
      patient_id,
      condition_id,
      encounter_id,
      diagnosis_date,
      condition_status,
      severity,
      notes
    )
    VALUES (
      $1,
      $2,
      $3,
      COALESCE($4::date, CURRENT_DATE),
      $5,
      $6,
      $7
    )
    RETURNING *;
  `;

  const values = [
    patientId,
    conditionId,
    encounterId || null,
    diagnosisDate || null,
    conditionStatus || null,
    severity || null,
    notes || null,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}


async function getPatientConditions(patientId) {
  const query = `
    SELECT
      pc.patient_condition_id,

      mc.condition_id,
      mc.condition_code,
      mc.condition_name,
      mc.description,

      pc.diagnosis_date,
      pc.condition_status,
      pc.severity,
      pc.notes,

      pc.encounter_id

    FROM patient_conditions pc

    INNER JOIN medical_conditions mc
      ON pc.condition_id = mc.condition_id

    WHERE pc.patient_id = $1

    ORDER BY pc.diagnosis_date DESC;
  `;

  const result = await pool.query(query, [patientId]);

  return result.rows;
}


async function getPatientConditionById(patientConditionId) {
  const query = `
    SELECT
      pc.patient_condition_id,

      p.patient_number,
      p.first_name,
      p.last_name,

      mc.condition_code,
      mc.condition_name,

      pc.diagnosis_date,
      pc.condition_status,
      pc.severity,
      pc.notes,

      pc.encounter_id

    FROM patient_conditions pc

    INNER JOIN patients p
      ON pc.patient_id = p.patient_id

    INNER JOIN medical_conditions mc
      ON pc.condition_id = mc.condition_id

    WHERE pc.patient_condition_id = $1;
  `;

  const result = await pool.query(
    query,
    [patientConditionId]
  );

  return result.rows[0] || null;
}


module.exports = {
  createCondition,
  getAllConditions,
  addPatientCondition,
  getPatientConditions,
  getPatientConditionById,
};