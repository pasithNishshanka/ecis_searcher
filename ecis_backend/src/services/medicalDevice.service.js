const pool = require('../config/database');


async function createMedicalDevice(deviceData) {
  const {
    patientId,
    encounterId,
    deviceType,
    deviceName,
    manufacturer,
    modelNumber,
    serialNumber,
    bodySite,
    laterality,
    implantationDate,
    removalDate,
    status,
    notes,
  } = deviceData;

  const query = `
    INSERT INTO medical_devices (
      patient_id,
      encounter_id,
      device_type,
      device_name,
      manufacturer,
      model_number,
      serial_number,
      body_site,
      laterality,
      implantation_date,
      removal_date,
      status,
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
      $9,
      $10,
      $11,
      COALESCE($12, 'ACTIVE'),
      $13
    )
    RETURNING *;
  `;

  const values = [
    patientId,
    encounterId || null,
    deviceType,
    deviceName || null,
    manufacturer || null,
    modelNumber || null,
    serialNumber || null,
    bodySite || null,
    laterality || null,
    implantationDate || null,
    removalDate || null,
    status || null,
    notes || null,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}


async function getPatientMedicalDevices(patientId) {
  const query = `
    SELECT
      md.device_id,

      md.device_type,
      md.device_name,

      md.manufacturer,
      md.model_number,
      md.serial_number,

      md.body_site,
      md.laterality,

      md.implantation_date,
      md.removal_date,

      md.status,
      md.notes,

      md.encounter_id

    FROM medical_devices md

    WHERE md.patient_id = $1

    ORDER BY
      md.implantation_date DESC NULLS LAST;
  `;

  const result = await pool.query(query, [patientId]);

  return result.rows;
}


async function getMedicalDeviceById(deviceId) {
  const query = `
    SELECT
      md.*,

      p.patient_number,
      p.first_name,
      p.last_name

    FROM medical_devices md

    INNER JOIN patients p
      ON md.patient_id = p.patient_id

    WHERE md.device_id = $1;
  `;

  const result = await pool.query(query, [deviceId]);

  return result.rows[0] || null;
}


module.exports = {
  createMedicalDevice,
  getPatientMedicalDevices,
  getMedicalDeviceById,
};