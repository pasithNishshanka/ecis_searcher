const pool = require("../config/database");

async function createEmergencyCase(caseData) {
  const {
    hospitalId,
    patientId,
    caseNumber,
    arrivalDate,
    arrivalMode,
    triageLevel,
    chiefComplaint,
    initialCondition,
    unidentifiedPatient,
    temporaryIdentityReference,
    assignedDoctorId,
  } = caseData;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // --------------------------------------------------
    // 1. Validate patient when the case is identified
    // --------------------------------------------------

    if (!unidentifiedPatient) {
      if (!patientId) {
        throw new Error(
          "patientId is required for an identified emergency case",
        );
      }

      const patientResult = await client.query(
        `
          SELECT
            patient_id,
            hospital_id,
            patient_number
          FROM patients
          WHERE
            patient_id = $1
            AND hospital_id = $2
            AND status = 'ACTIVE'
          FOR SHARE;
        `,
        [patientId, hospitalId],
      );

      if (patientResult.rowCount === 0) {
        throw new Error("Active patient not found for selected hospital");
      }
    }

    // --------------------------------------------------
    // 2. Unidentified case validation
    // --------------------------------------------------

    if (unidentifiedPatient) {
      if (patientId) {
        throw new Error(
          "An unidentified emergency case cannot have a permanent patient_id",
        );
      }

      if (!temporaryIdentityReference || !temporaryIdentityReference.trim()) {
        throw new Error(
          "temporaryIdentityReference is required for unidentified cases",
        );
      }
    }

    // --------------------------------------------------
    // 3. Create emergency encounter when needed
    // --------------------------------------------------

    let encounterId = null;

    if (patientId) {
      const encounterResult = await client.query(
        `
          INSERT INTO encounters (
            patient_id,
            hospital_id,
            encounter_type,
            encounter_date,
            department,
            status,
            chief_complaint,
            notes
          )
          VALUES (
            $1,
            $2,
            'EMERGENCY',
            COALESCE($3::timestamp, CURRENT_TIMESTAMP),
            'Emergency Department',
            'OPEN',
            $4,
            $5
          )
          RETURNING encounter_id;
        `,
        [
          patientId,
          hospitalId,
          arrivalDate || null,
          chiefComplaint || null,
          initialCondition || null,
        ],
      );

      encounterId = encounterResult.rows[0].encounter_id;
    }

    // --------------------------------------------------
    // 4. Create emergency case
    // --------------------------------------------------

    const emergencyResult = await client.query(
      `
        INSERT INTO emergency_cases (
          hospital_id,
          encounter_id,
          patient_id,
          case_number,
          arrival_date,
          arrival_mode,
          triage_level,
          chief_complaint,
          initial_condition,
          unidentified_patient,
          temporary_identity_reference,
          assigned_doctor_id,
          status
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
          $11,
          $12,
          'IN_TREATMENT'
        )
        RETURNING *;
      `,
      [
        hospitalId,
        encounterId,
        patientId || null,
        caseNumber,
        arrivalDate || null,
        arrivalMode || null,
        triageLevel || null,
        chiefComplaint || null,
        initialCondition || null,
        Boolean(unidentifiedPatient),
        temporaryIdentityReference || null,
        assignedDoctorId || null,
      ],
    );

    await client.query("COMMIT");

    return {
      encounterId,
      emergencyCase: emergencyResult.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getEmergencyCases() {
  const query = `
    SELECT
      e.emergency_case_id,
      e.case_number,

      e.arrival_date,
      e.arrival_mode,
      e.triage_level,

      e.chief_complaint,
      e.initial_condition,

      e.unidentified_patient,
      e.temporary_identity_reference,

      e.status,

      p.patient_id,
      p.patient_number,

      CONCAT(
        p.first_name,
        ' ',
        COALESCE(p.last_name, '')
      ) AS patient_name,

      h.hospital_id,
      h.hospital_name,

      u.user_id AS assigned_doctor_id,
      u.full_name AS assigned_doctor_name

    FROM emergency_cases e

    INNER JOIN hospitals h
      ON e.hospital_id = h.hospital_id

    LEFT JOIN patients p
      ON e.patient_id = p.patient_id

    LEFT JOIN hospital_users u
      ON e.assigned_doctor_id = u.user_id

    ORDER BY e.arrival_date DESC;
  `;

  const result = await pool.query(query);

  return result.rows;
}

async function getEmergencyCaseById(emergencyCaseId) {
  const query = `
    SELECT
      e.*,

      p.patient_number,
      p.first_name,
      p.last_name,

      h.hospital_name,

      u.full_name AS assigned_doctor_name

    FROM emergency_cases e

    INNER JOIN hospitals h
      ON e.hospital_id = h.hospital_id

    LEFT JOIN patients p
      ON e.patient_id = p.patient_id

    LEFT JOIN hospital_users u
      ON e.assigned_doctor_id = u.user_id

    WHERE e.emergency_case_id = $1;
  `;

  const result = await pool.query(query, [emergencyCaseId]);

  return result.rows[0] || null;
}

module.exports = {
  createEmergencyCase,
  getEmergencyCases,
  getEmergencyCaseById,
};
