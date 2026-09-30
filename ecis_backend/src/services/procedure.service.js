const pool = require("../config/database");

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function optionalText(value) {
  const parsed = String(value ?? "").trim();
  return parsed || null;
}

async function createProcedure(data) {
  const patientId = positiveInteger(data.patientId, "patientId");
  const hospitalId = positiveInteger(data.hospitalId, "hospitalId");
  const encounterId = positiveInteger(data.encounterId, "encounterId");
  const performedBy = positiveInteger(data.performedBy, "performedBy");
  const actorUserId = positiveInteger(data.actorUserId, "actorUserId");
  const procedureName = optionalText(data.procedureName);
  if (!procedureName) throw new Error("procedureName is required");

  const procedureDate = data.procedureDate == null || data.procedureDate === ""
    ? null : new Date(data.procedureDate);
  if (procedureDate && Number.isNaN(procedureDate.getTime())) {
    throw new Error("procedureDate is invalid");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const patient = await client.query(
      `SELECT p.patient_id
         FROM public.patients p
        WHERE p.patient_id = $1 AND p.status = 'ACTIVE'
          AND EXISTS (
            SELECT 1 FROM public.patient_hospital_registrations phr
            WHERE phr.patient_id = p.patient_id
              AND phr.hospital_id = $2 AND phr.status = 'ACTIVE'
          )
        FOR SHARE OF p;`,
      [patientId, hospitalId],
    );
    if (!patient.rowCount) throw new Error("Patient is not registered at this hospital");

    const encounter = await client.query(
      `SELECT encounter_id FROM public.encounters
        WHERE encounter_id = $1 AND patient_id = $2 AND hospital_id = $3
        FOR SHARE;`,
      [encounterId, patientId, hospitalId],
    );
    if (!encounter.rowCount) throw new Error("Encounter does not belong to this patient and hospital");

    const provider = await client.query(
      `SELECT u.user_id FROM public.hospital_users u
        JOIN public.hospital_user_assignments a ON a.user_id = u.user_id
       WHERE u.user_id = $1 AND u.is_active = TRUE
         AND a.hospital_id = $2 AND a.role IN ('DOCTOR', 'SURGEON')
         AND a.status = 'ACTIVE' AND a.start_date <= CURRENT_DATE
         AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
       LIMIT 1 FOR SHARE OF u, a;`,
      [performedBy, hospitalId],
    );
    if (!provider.rowCount) throw new Error("Select an active doctor for this hospital");

    const result = await client.query(
      `INSERT INTO public.procedures (
         patient_id, encounter_id, procedure_code, procedure_name,
         procedure_date, body_site, laterality, performed_by,
         indication, findings, outcome
       ) VALUES (
         $1, $2, $3, $4, COALESCE($5::timestamp, CURRENT_TIMESTAMP),
         $6, $7, $8, $9, $10, $11
       ) RETURNING *;`,
      [patientId, encounterId, optionalText(data.procedureCode), procedureName,
        procedureDate, optionalText(data.bodySite), optionalText(data.laterality),
        performedBy, optionalText(data.indication), optionalText(data.findings),
        optionalText(data.outcome)],
    );

    await client.query(
      `INSERT INTO public.audit_logs (
         hospital_id, user_id, action_type, entity_type, entity_id, new_values
       ) VALUES ($1, $2, 'PROCEDURE_CREATED', 'procedure', $3, $4::jsonb);`,
      [hospitalId, actorUserId, result.rows[0].procedure_id,
        JSON.stringify({ patientId, encounterId, performedBy })],
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

async function getPatientProcedures(patientIdValue, hospitalIdValue) {
  const patientId = positiveInteger(patientIdValue, "patientId");
  const hospitalId = positiveInteger(hospitalIdValue, "hospitalId");
  const result = await pool.query(
    `SELECT pr.procedure_id, pr.procedure_code, pr.procedure_name,
            pr.procedure_date, pr.body_site, pr.laterality, pr.indication,
            pr.findings, pr.outcome, pr.encounter_id,
            e.hospital_id, u.user_id AS performed_by_id,
            u.full_name AS performed_by_name
       FROM public.procedures pr
       JOIN public.encounters e ON e.encounter_id = pr.encounter_id
       LEFT JOIN public.hospital_users u ON u.user_id = pr.performed_by
      WHERE pr.patient_id = $1
        AND EXISTS (
          SELECT 1 FROM public.patient_hospital_registrations phr
          WHERE phr.patient_id = pr.patient_id
            AND phr.hospital_id = $2 AND phr.status = 'ACTIVE'
        )
      ORDER BY pr.procedure_date DESC, pr.procedure_id DESC;`,
    [patientId, hospitalId],
  );
  return result.rows;
}

module.exports = { createProcedure, getPatientProcedures };
