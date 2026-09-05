const pool = require('../config/database');


async function createProcedure(procedureData) {
  const {
    patientId,
    encounterId,
    procedureCode,
    procedureName,
    procedureDate,
    bodySite,
    laterality,
    performedBy,
    indication,
    findings,
    outcome,
  } = procedureData;

  const query = `
    INSERT INTO procedures (
      patient_id,
      encounter_id,
      procedure_code,
      procedure_name,
      procedure_date,
      body_site,
      laterality,
      performed_by,
      indication,
      findings,
      outcome
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
      $10,
      $11
    )
    RETURNING *;
  `;

  const values = [
    patientId,
    encounterId,
    procedureCode || null,
    procedureName,
    procedureDate || null,
    bodySite || null,
    laterality || null,
    performedBy || null,
    indication || null,
    findings || null,
    outcome || null,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}


async function getPatientProcedures(patientId) {
  const query = `
    SELECT
      pr.procedure_id,
      pr.procedure_code,
      pr.procedure_name,
      pr.procedure_date,
      pr.body_site,
      pr.laterality,
      pr.indication,
      pr.findings,
      pr.outcome,
      pr.encounter_id,

      u.user_id AS performed_by_id,
      u.full_name AS performed_by_name

    FROM procedures pr

    LEFT JOIN hospital_users u
      ON pr.performed_by = u.user_id

    WHERE pr.patient_id = $1

    ORDER BY pr.procedure_date DESC;
  `;

  const result = await pool.query(query, [patientId]);

  return result.rows;
}


module.exports = {
  createProcedure,
  getPatientProcedures,
};