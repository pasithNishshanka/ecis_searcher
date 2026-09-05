const pool = require("../config/database");

async function createInvestigation(investigationData) {
  const {
    patientId,
    encounterId,
    investigationType,
    investigationName,
    requestedDate,
    performedDate,
    resultSummary,
    resultValue,
    unit,
    referenceRange,
    bodySite,
    performedBy,
    reportReference,
  } = investigationData;

  const query = `
    INSERT INTO investigations (
      patient_id,
      encounter_id,
      investigation_type,
      investigation_name,
      requested_date,
      performed_date,
      result_summary,
      result_value,
      unit,
      reference_range,
      body_site,
      performed_by,
      report_reference
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
      $10,
      $11,
      $12,
      $13
    )
    RETURNING *;
  `;

  const values = [
    patientId,
    encounterId,
    investigationType,
    investigationName,
    requestedDate || null,
    performedDate || null,
    resultSummary || null,
    resultValue || null,
    unit || null,
    referenceRange || null,
    bodySite || null,
    performedBy || null,
    reportReference || null,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}

async function getPatientInvestigations(patientId) {
  const query = `
    SELECT
      i.investigation_id,

      i.investigation_type,
      i.investigation_name,

      i.requested_date,
      i.performed_date,

      i.result_summary,
      i.result_value,
      i.unit,
      i.reference_range,

      i.body_site,

      i.report_reference,

      i.encounter_id,

      u.user_id AS performed_by_id,
      u.full_name AS performed_by_name

    FROM investigations i

    LEFT JOIN hospital_users u
      ON i.performed_by = u.user_id

    WHERE i.patient_id = $1

    ORDER BY i.performed_date DESC;
  `;

  const result = await pool.query(query, [patientId]);

  return result.rows;
}

async function getInvestigationById(investigationId) {
  const query = `
    SELECT
      i.*,

      p.patient_number,
      p.first_name,
      p.last_name,

      u.full_name AS performed_by_name

    FROM investigations i

    INNER JOIN patients p
      ON i.patient_id = p.patient_id

    LEFT JOIN hospital_users u
      ON i.performed_by = u.user_id

    WHERE i.investigation_id = $1;
  `;

  const result = await pool.query(query, [investigationId]);

  return result.rows[0] || null;
}

module.exports = {
  createInvestigation,
  getPatientInvestigations,
  getInvestigationById,
};
