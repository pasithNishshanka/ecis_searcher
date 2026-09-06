const pool = require("../config/database");

async function createProcedure(procedureData) {
  const {
    patientId,
    hospitalId,
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

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /*
     * Confirm patient exists.
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
     * Ensure patient belongs
     * to authenticated hospital.
     */
    if (hospitalId && Number(patientHospitalId) !== Number(hospitalId)) {
      throw new Error("Patient does not belong to the authenticated hospital");
    }

    const result = await client.query(
      `
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
            COALESCE(
              $5::timestamp,
              CURRENT_TIMESTAMP
            ),
            $6,
            $7,
            $8,
            $9,
            $10,
            $11
          )
          RETURNING *;
        `,
      [
        patientId,
        encounterId || null,
        procedureCode || null,
        procedureName,
        procedureDate || null,
        bodySite || null,
        laterality || null,
        performedBy || null,
        indication || null,
        findings || null,
        outcome || null,
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
      ON pr.performed_by =
         u.user_id

    WHERE pr.patient_id = $1

    ORDER BY
      pr.procedure_date DESC;
  `;

  const result = await pool.query(query, [patientId]);

  return result.rows;
}

module.exports = {
  createProcedure,
  getPatientProcedures,
};
