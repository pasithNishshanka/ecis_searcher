const pool = require('../config/database');

/**
 * Create a new patient
 */
async function createPatient(patientData) {
  const {
    hospitalId,
    patientNumber,
    nicNumber,
    passportNumber,
    firstName,
    middleName,
    lastName,
    dateOfBirth,
    gender,
    bloodGroup,
    heightCm,
    weightKg,
    nationality,
    primaryPhone,
    secondaryPhone,
    email,
    occupation,
    status,
  } = patientData;

  const query = `
    INSERT INTO patients (
      hospital_id,
      patient_number,
      nic_number,
      passport_number,
      first_name,
      middle_name,
      last_name,
      date_of_birth,
      gender,
      blood_group,
      height_cm,
      weight_kg,
      nationality,
      primary_phone,
      secondary_phone,
      email,
      occupation,
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
      $10,
      $11,
      $12,
      $13,
      $14,
      $15,
      $16,
      $17,
      $18
    )
    RETURNING
      patient_id,
      hospital_id,
      patient_number,
      nic_number,
      passport_number,
      first_name,
      middle_name,
      last_name,
      date_of_birth,
      gender,
      blood_group,
      height_cm,
      weight_kg,
      nationality,
      primary_phone,
      secondary_phone,
      email,
      occupation,
      status,
      registered_at,
      created_at,
      updated_at;
  `;

  const values = [
    hospitalId,
    patientNumber,
    nicNumber || null,
    passportNumber || null,
    firstName,
    middleName || null,
    lastName || null,
    dateOfBirth || null,
    gender || null,
    bloodGroup || null,
    heightCm ?? null,
    weightKg ?? null,
    nationality || null,
    primaryPhone || null,
    secondaryPhone || null,
    email || null,
    occupation || null,
    status || 'ACTIVE',
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}


/**
 * Get all patients
 */
async function getAllPatients() {
  const query = `
    SELECT
      p.patient_id,
      p.patient_number,
      p.first_name,
      p.middle_name,
      p.last_name,
      p.date_of_birth,
      p.gender,
      p.blood_group,
      p.height_cm,
      p.weight_kg,
      p.primary_phone,
      p.email,
      p.occupation,
      p.status,
      p.registered_at,

      h.hospital_id,
      h.hospital_code,
      h.hospital_name

    FROM patients p

    INNER JOIN hospitals h
      ON p.hospital_id = h.hospital_id

    ORDER BY p.created_at DESC;
  `;

  const result = await pool.query(query);

  return result.rows;
}


/**
 * Get one patient using patient number
 */
async function getPatientByNumber(patientNumber) {
  const query = `
    SELECT
      p.patient_id,
      p.hospital_id,
      p.patient_number,

      p.nic_number,
      p.passport_number,

      p.first_name,
      p.middle_name,
      p.last_name,

      p.date_of_birth,
      p.gender,

      p.blood_group,

      p.height_cm,
      p.weight_kg,

      p.nationality,

      p.primary_phone,
      p.secondary_phone,

      p.email,
      p.occupation,

      p.status,

      p.registered_at,
      p.created_at,
      p.updated_at,

      h.hospital_code,
      h.hospital_name,
      h.hospital_type,
      h.province,
      h.district,
      h.address AS hospital_address,
      h.phone AS hospital_phone,
      h.email AS hospital_email

    FROM patients p

    INNER JOIN hospitals h
      ON p.hospital_id = h.hospital_id

    WHERE p.patient_number = $1;
  `;

  const result = await pool.query(query, [patientNumber]);

  return result.rows[0] || null;
}


/**
 * Search patients
 *
 * Searches the existing patient records using:
 * patient number, name, NIC and phone.
 */
async function searchPatients(searchTerm) {
  const query = `
    SELECT
      p.patient_id,
      p.patient_number,

      p.first_name,
      p.middle_name,
      p.last_name,

      p.date_of_birth,
      p.gender,

      p.blood_group,

      p.height_cm,
      p.weight_kg,

      p.primary_phone,
      p.nic_number,

      p.status,

      h.hospital_id,
      h.hospital_code,
      h.hospital_name

    FROM patients p

    INNER JOIN hospitals h
      ON p.hospital_id = h.hospital_id

    WHERE
      p.patient_number ILIKE $1
      OR p.first_name ILIKE $1
      OR p.middle_name ILIKE $1
      OR p.last_name ILIKE $1
      OR p.nic_number ILIKE $1
      OR p.primary_phone ILIKE $1

    ORDER BY
      p.first_name ASC,
      p.last_name ASC

    LIMIT 20;
  `;

  const values = [`%${searchTerm}%`];

  const result = await pool.query(query, values);

  return result.rows;
}


/**
 * Get patient profile/history foundation
 *
 * At this stage this returns the central patient
 * and hospital information.
 *
 * Later we will extend this with:
 * OPD
 * Clinics
 * Admissions
 * Treatments
 * Investigations
 * Surgeries
 * Procedures
 * Fractures
 * Dental records
 * Medical devices
 */
async function getPatientHistory(patientNumber) {
  const query = `
    SELECT
      p.patient_id,
      p.hospital_id,
      p.patient_number,

      p.nic_number,
      p.passport_number,

      p.first_name,
      p.middle_name,
      p.last_name,

      p.date_of_birth,
      p.gender,

      p.blood_group,

      p.height_cm,
      p.weight_kg,

      p.nationality,

      p.primary_phone,
      p.secondary_phone,

      p.email,
      p.occupation,

      p.status,

      p.registered_at,
      p.created_at,
      p.updated_at,

      h.hospital_id AS hospital_reference_id,
      h.hospital_code,
      h.hospital_name,
      h.hospital_type,
      h.province,
      h.district,
      h.address AS hospital_address,
      h.phone AS hospital_phone,
      h.email AS hospital_email

    FROM patients p

    INNER JOIN hospitals h
      ON p.hospital_id = h.hospital_id

    WHERE p.patient_number = $1;
  `;

  const result = await pool.query(query, [patientNumber]);

  return result.rows[0] || null;
}


/**
 * Update patient
 */
async function updatePatient(patientNumber, patientData) {
  const {
    firstName,
    middleName,
    lastName,
    dateOfBirth,
    gender,
    bloodGroup,
    heightCm,
    weightKg,
    nationality,
    primaryPhone,
    secondaryPhone,
    email,
    occupation,
    status,
  } = patientData;

  const query = `
    UPDATE patients
    SET
      first_name = COALESCE($1, first_name),
      middle_name = COALESCE($2, middle_name),
      last_name = COALESCE($3, last_name),
      date_of_birth = COALESCE($4, date_of_birth),
      gender = COALESCE($5, gender),
      blood_group = COALESCE($6, blood_group),
      height_cm = COALESCE($7, height_cm),
      weight_kg = COALESCE($8, weight_kg),
      nationality = COALESCE($9, nationality),
      primary_phone = COALESCE($10, primary_phone),
      secondary_phone = COALESCE($11, secondary_phone),
      email = COALESCE($12, email),
      occupation = COALESCE($13, occupation),
      status = COALESCE($14, status),
      updated_at = CURRENT_TIMESTAMP

    WHERE patient_number = $15

    RETURNING
      patient_id,
      hospital_id,
      patient_number,
      nic_number,
      passport_number,
      first_name,
      middle_name,
      last_name,
      date_of_birth,
      gender,
      blood_group,
      height_cm,
      weight_kg,
      nationality,
      primary_phone,
      secondary_phone,
      email,
      occupation,
      status,
      registered_at,
      created_at,
      updated_at;
  `;

  const values = [
    firstName ?? null,
    middleName ?? null,
    lastName ?? null,
    dateOfBirth ?? null,
    gender ?? null,
    bloodGroup ?? null,
    heightCm ?? null,
    weightKg ?? null,
    nationality ?? null,
    primaryPhone ?? null,
    secondaryPhone ?? null,
    email ?? null,
    occupation ?? null,
    status ?? null,
    patientNumber,
  ];

  const result = await pool.query(query, values);

  return result.rows[0] || null;
}


/**
 * Export all patient service functions
 *
 * IMPORTANT:
 * The controller depends on these names.
 */
module.exports = {
  createPatient,
  getAllPatients,
  getPatientByNumber,
  updatePatient,
  searchPatients,
  getPatientHistory,
};