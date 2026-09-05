const pool = require('../config/database');


async function createFracture(fractureData) {
  const {
    patientId,
    encounterId,
    bodyPart,
    laterality,
    fractureType,
    fractureDate,
    treatmentDescription,
    healedDate,
    notes,
  } = fractureData;

  const query = `
    INSERT INTO fractures (
      patient_id,
      encounter_id,
      body_part,
      laterality,
      fracture_type,
      fracture_date,
      treatment_description,
      healed_date,
      notes
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
      $9
    )
    RETURNING *;
  `;

  const values = [
    patientId,
    encounterId,
    bodyPart,
    laterality || null,
    fractureType || null,
    fractureDate || null,
    treatmentDescription || null,
    healedDate || null,
    notes || null,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}


async function getPatientFractures(patientId) {
  const query = `
    SELECT
      f.fracture_id,

      f.body_part,
      f.laterality,
      f.fracture_type,

      f.fracture_date,
      f.treatment_description,
      f.healed_date,

      f.notes,

      f.encounter_id

    FROM fractures f

    WHERE f.patient_id = $1

    ORDER BY f.fracture_date DESC;
  `;

  const result = await pool.query(query, [patientId]);

  return result.rows;
}


async function getFractureById(fractureId) {
  const query = `
    SELECT
      f.*,

      p.patient_number,
      p.first_name,
      p.last_name

    FROM fractures f

    INNER JOIN patients p
      ON f.patient_id = p.patient_id

    WHERE f.fracture_id = $1;
  `;

  const result = await pool.query(query, [fractureId]);

  return result.rows[0] || null;
}


module.exports = {
  createFracture,
  getPatientFractures,
  getFractureById,
};