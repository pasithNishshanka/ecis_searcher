const pool = require("../config/database");

async function createClinicalObservation(observationData) {
  const {
    patientId,
    encounterId,
    treatmentId,
    observationType,
    observationValue,
    bodySite,
    laterality,
    observedDate,
    recordedBy,
    notes,
  } = observationData;

  const query = `
    INSERT INTO clinical_observations (
      patient_id,
      encounter_id,
      treatment_id,
      observation_type,
      observation_value,
      body_site,
      laterality,
      observed_date,
      recorded_by,
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
      COALESCE($8::timestamp, CURRENT_TIMESTAMP),
      $9,
      $10
    )
    RETURNING *;
  `;

  const values = [
    patientId,
    encounterId,
    treatmentId || null,
    observationType,
    observationValue,
    bodySite || null,
    laterality || null,
    observedDate || null,
    recordedBy || null,
    notes || null,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}

async function getPatientObservations(patientId) {
  const query = `
    SELECT
      co.observation_id,

      co.observation_type,
      co.observation_value,

      co.body_site,
      co.laterality,

      co.observed_date,

      co.notes,

      co.encounter_id,
      co.treatment_id,

      u.user_id AS recorded_by_id,
      u.full_name AS recorded_by_name

    FROM clinical_observations co

    LEFT JOIN hospital_users u
      ON co.recorded_by = u.user_id

    WHERE co.patient_id = $1

    ORDER BY co.observed_date DESC;
  `;

  const result = await pool.query(query, [patientId]);

  return result.rows;
}

async function getObservationById(observationId) {
  const query = `
    SELECT
      co.*,

      p.patient_number,
      p.first_name,
      p.last_name,

      u.full_name AS recorded_by_name

    FROM clinical_observations co

    INNER JOIN patients p
      ON co.patient_id = p.patient_id

    LEFT JOIN hospital_users u
      ON co.recorded_by = u.user_id

    WHERE co.observation_id = $1;
  `;

  const result = await pool.query(query, [observationId]);

  return result.rows[0] || null;
}

module.exports = {
  createClinicalObservation,
  getPatientObservations,
  getObservationById,
};
