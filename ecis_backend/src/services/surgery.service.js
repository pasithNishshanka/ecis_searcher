const pool = require("../config/database");

async function createSurgery(surgeryData) {
  const {
    patientId,
    hospitalId,
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

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /*
     * Confirm that the selected patient exists.
     */
    const patientResult = await client.query(
      `
          SELECT
            patient_id,
            hospital_id
          FROM patients
          WHERE patient_id = $1
          LIMIT 1;
        `,
      [patientId],
    );

    if (!patientResult.rows[0]) {
      throw new Error("Patient not found");
    }

    const patientHospitalId = patientResult.rows[0].hospital_id;

    /*
     * Ensure the selected patient
     * belongs to the logged-in hospital.
     */
    if (hospitalId && Number(patientHospitalId) !== Number(hospitalId)) {
      throw new Error("Patient does not belong to the authenticated hospital");
    }

    const result = await client.query(
      `
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
            COALESCE(
              $6::timestamp,
              CURRENT_TIMESTAMP
            ),
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
        `,
      [
        patientId,
        encounterId || null,
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
      ],
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
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
      ON s.surgeon_user_id =
         u.user_id

    WHERE s.patient_id = $1

    ORDER BY
      s.surgery_date DESC;
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
      ON s.patient_id =
         p.patient_id

    LEFT JOIN hospital_users u
      ON s.surgeon_user_id =
         u.user_id

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
