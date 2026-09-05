const pool = require("../config/database");

async function createDentalRecord(dentalData) {
  const {
    patientId,
    encounterId,
    recordDate,
    toothNumber,
    condition,
    treatment,
    fillingType,
    crownPresent,
    implantPresent,
    missingTooth,
    recordedBy,
    notes,
  } = dentalData;

  const query = `
    INSERT INTO dental_records (
      patient_id,
      encounter_id,
      record_date,
      tooth_number,
      condition,
      treatment,
      filling_type,
      crown_present,
      implant_present,
      missing_tooth,
      recorded_by,
      notes
    )
    VALUES (
      $1,
      $2,
      COALESCE($3::date, CURRENT_DATE),
      $4,
      $5,
      $6,
      $7,
      COALESCE($8, FALSE),
      COALESCE($9, FALSE),
      COALESCE($10, FALSE),
      $11,
      $12
    )
    RETURNING *;
  `;

  const values = [
    patientId,
    encounterId || null,
    recordDate || null,
    toothNumber || null,
    condition || null,
    treatment || null,
    fillingType || null,
    crownPresent,
    implantPresent,
    missingTooth,
    recordedBy || null,
    notes || null,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}

async function getPatientDentalRecords(patientId) {
  const query = `
    SELECT
      d.dental_record_id,

      d.record_date,
      d.tooth_number,

      d.condition,
      d.treatment,
      d.filling_type,

      d.crown_present,
      d.implant_present,
      d.missing_tooth,

      d.notes,

      d.encounter_id,

      u.user_id AS recorded_by_id,
      u.full_name AS recorded_by_name

    FROM dental_records d

    LEFT JOIN hospital_users u
      ON d.recorded_by = u.user_id

    WHERE d.patient_id = $1

    ORDER BY d.record_date DESC;
  `;

  const result = await pool.query(query, [patientId]);

  return result.rows;
}

async function getDentalRecordById(dentalRecordId) {
  const query = `
    SELECT
      d.*,

      p.patient_number,
      p.first_name,
      p.last_name,

      u.full_name AS recorded_by_name

    FROM dental_records d

    INNER JOIN patients p
      ON d.patient_id = p.patient_id

    LEFT JOIN hospital_users u
      ON d.recorded_by = u.user_id

    WHERE d.dental_record_id = $1;
  `;

  const result = await pool.query(query, [dentalRecordId]);

  return result.rows[0] || null;
}

module.exports = {
  createDentalRecord,
  getPatientDentalRecords,
  getDentalRecordById,
};
