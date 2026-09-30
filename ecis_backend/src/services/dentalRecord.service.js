const pool = require("../config/database");

function positiveInteger(value, label) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return number;
}

function requiredText(value, label) {
  const text = String(value || "").trim();

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  return text;
}

async function assertPatientAccess(client, patientId, hospitalId) {
  const result = await client.query(
    `
      SELECT patient_id
      FROM public.patients p
      WHERE
        p.patient_id = $1
        AND p.status = 'ACTIVE'
        AND EXISTS (
          SELECT 1 FROM public.patient_hospital_registrations phr
          WHERE phr.patient_id = p.patient_id
            AND phr.hospital_id = $2
            AND phr.status = 'ACTIVE'
        )
      FOR SHARE;
    `,
    [patientId, hospitalId],
  );

  if (result.rowCount === 0) {
    throw new Error("Active patient not found for the authenticated hospital.");
  }
}

async function assertClinicianAccess(client, userId, hospitalId) {
  const result = await client.query(
    `
      SELECT user_id
      FROM public.hospital_users u
      WHERE
        u.user_id = $1
        AND u.is_active = TRUE
        AND EXISTS (
          SELECT 1 FROM public.hospital_user_assignments a
          WHERE a.user_id = u.user_id
            AND a.hospital_id = $2
            AND a.status = 'ACTIVE'
            AND a.start_date <= CURRENT_DATE
            AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
        )
      FOR SHARE;
    `,
    [userId, hospitalId],
  );

  if (result.rowCount === 0) {
    throw new Error("Authenticated hospital clinician is not active.");
  }
}

async function assertEncounterAccess(
  client,
  encounterId,
  patientId,
  hospitalId,
) {
  if (!encounterId) {
    return null;
  }

  const normalizedEncounterId = positiveInteger(
    encounterId,
    "encounterId",
  );

  const result = await client.query(
    `
      SELECT encounter_id
      FROM public.encounters
      WHERE
        encounter_id = $1
        AND patient_id = $2
        AND hospital_id = $3
      FOR SHARE;
    `,
    [normalizedEncounterId, patientId, hospitalId],
  );

  if (result.rowCount === 0) {
    throw new Error("Encounter not found for the selected patient and hospital.");
  }

  return normalizedEncounterId;
}

async function createDentalEncounter(
  client,
  {
    patientId,
    hospitalId,
    recordedBy,
    recordDate,
    condition,
    notes,
  },
) {
  const result = await client.query(
    `
      INSERT INTO public.encounters (
        patient_id,
        hospital_id,
        encounter_type,
        encounter_date,
        attending_user_id,
        department,
        status,
        chief_complaint,
        notes
      )
      VALUES (
        $1,
        $2,
        'DENTAL',
        COALESCE($3::date, CURRENT_DATE)::timestamp,
        $4,
        'Dental Clinic',
        'COMPLETED',
        NULLIF($5, ''),
        NULLIF($6, '')
      )
      RETURNING encounter_id;
    `,
    [
      patientId,
      hospitalId,
      recordDate || null,
      recordedBy,
      String(condition || "").trim(),
      String(notes || "").trim(),
    ],
  );

  return result.rows[0].encounter_id;
}

async function createDentalRecord(dentalData) {
  const patientId = positiveInteger(dentalData.patientId, "patientId");
  const hospitalId = positiveInteger(dentalData.hospitalId, "hospitalId");
  const recordedBy = positiveInteger(dentalData.recordedBy, "recordedBy");
  const toothNumber = requiredText(dentalData.toothNumber, "toothNumber");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await assertPatientAccess(client, patientId, hospitalId);
    await assertClinicianAccess(client, recordedBy, hospitalId);

    let encounterId = await assertEncounterAccess(
      client,
      dentalData.encounterId,
      patientId,
      hospitalId,
    );

    /*
     * A dental record is a clinical activity, never an isolated
     * patient note. When a caller has not supplied an existing
     * encounter, create the Dental Clinic encounter in the same
     * transaction and link the record to it.
     */
    if (!encounterId) {
      encounterId = await createDentalEncounter(
        client,
        {
          patientId,
          hospitalId,
          recordedBy,
          recordDate: dentalData.recordDate,
          condition: dentalData.condition,
          notes: dentalData.notes,
        },
      );
    }

    const result = await client.query(
      `
        INSERT INTO public.dental_records (
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
          NULLIF($5, ''),
          NULLIF($6, ''),
          NULLIF($7, ''),
          COALESCE($8, FALSE),
          COALESCE($9, FALSE),
          COALESCE($10, FALSE),
          $11,
          NULLIF($12, '')
        )
        RETURNING *;
      `,
      [
        patientId,
        encounterId,
        dentalData.recordDate || null,
        toothNumber,
        String(dentalData.condition || "").trim(),
        String(dentalData.treatment || "").trim(),
        String(dentalData.fillingType || "").trim(),
        dentalData.crownPresent,
        dentalData.implantPresent,
        dentalData.missingTooth,
        recordedBy,
        String(dentalData.notes || "").trim(),
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

async function getPatientDentalRecords(patientIdValue, hospitalIdValue) {
  const patientId = positiveInteger(patientIdValue, "patientId");
  const hospitalId = positiveInteger(hospitalIdValue, "hospitalId");

  const result = await pool.query(
    `
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
      FROM public.dental_records d
      INNER JOIN public.patients p
        ON p.patient_id = d.patient_id
      INNER JOIN public.encounters e
        ON e.encounter_id = d.encounter_id
       AND e.hospital_id = $2
      LEFT JOIN public.hospital_users u
        ON u.user_id = d.recorded_by
      WHERE d.patient_id = $1
      ORDER BY d.record_date DESC, d.dental_record_id DESC;
    `,
    [patientId, hospitalId],
  );

  return result.rows;
}

async function getDentalRecordById(dentalRecordIdValue, hospitalIdValue) {
  const dentalRecordId = positiveInteger(
    dentalRecordIdValue,
    "dentalRecordId",
  );
  const hospitalId = positiveInteger(hospitalIdValue, "hospitalId");

  const result = await pool.query(
    `
      SELECT
        d.*,
        p.patient_number,
        p.first_name,
        p.last_name,
        u.full_name AS recorded_by_name
      FROM public.dental_records d
      INNER JOIN public.patients p
        ON p.patient_id = d.patient_id
      INNER JOIN public.encounters e
        ON e.encounter_id = d.encounter_id
       AND e.hospital_id = $2
      LEFT JOIN public.hospital_users u
        ON u.user_id = d.recorded_by
      WHERE d.dental_record_id = $1;
    `,
    [dentalRecordId, hospitalId],
  );

  return result.rows[0] || null;
}

module.exports = {
  createDentalRecord,
  getPatientDentalRecords,
  getDentalRecordById,
};
