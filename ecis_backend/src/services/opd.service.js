const pool = require("../config/database");

function cleanString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();

  return text || null;
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return [
    "true",
    "1",
    "yes",
    "y",
  ].includes(
    String(value).trim().toLowerCase(),
  );
}

function validatePatientId(value) {
  const patientId = Number(value);

  if (
    !Number.isInteger(patientId) ||
    patientId <= 0
  ) {
    throw new Error(
      "A valid patientId is required.",
    );
  }

  return patientId;
}

function validateHospitalId(value) {
  const hospitalId = Number(value);

  if (
    !Number.isInteger(hospitalId) ||
    hospitalId <= 0
  ) {
    throw new Error(
      "Authenticated hospital context is required.",
    );
  }

  return hospitalId;
}

function validateUserId(value) {
  const userId = Number(value);

  if (
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    throw new Error(
      "Authenticated user context is required.",
    );
  }

  return userId;
}

function normalizeVisitDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      "Invalid OPD visit date.",
    );
  }

  return date.toISOString();
}

function buildOpdNumber() {
  const datePart = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  return `OPD-${datePart}-${Date.now()}`;
}

async function createOpdVisit(opdData) {
  const patientId =
    validatePatientId(
      opdData.patientId,
    );

  const hospitalId =
    validateHospitalId(
      opdData.hospitalId,
    );

  const doctorUserId =
    validateUserId(
      opdData.doctorUserId,
    );

  const department =
    cleanString(
      opdData.department,
    );

  const chiefComplaint =
    cleanString(
      opdData.chiefComplaint,
    );

  const clinicalNotes =
    cleanString(
      opdData.clinicalNotes,
    );

  const diagnosisSummary =
    cleanString(
      opdData.diagnosisSummary,
    );

  const followUpRequired =
    parseBoolean(
      opdData.followUpRequired,
    );

  const followUpDate =
    opdData.followUpDate ||
    null;

  const visitDate =
    normalizeVisitDate(
      opdData.visitDate,
    );

  const opdNumber =
    cleanString(
      opdData.opdNumber,
    ) ||
    buildOpdNumber();

  if (!chiefComplaint) {
    throw new Error(
      "Chief complaint is required.",
    );
  }

  if (!diagnosisSummary) {
    throw new Error(
      "Diagnosis summary is required.",
    );
  }

  if (
    followUpRequired &&
    !followUpDate
  ) {
    throw new Error(
      "Follow-up date is required when follow-up is selected.",
    );
  }

  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN",
    );

    /*
     * Patient must belong to the authenticated hospital.
     */
    const patientResult =
      await client.query(
        `
          SELECT
            patient_id,
            hospital_id,
            patient_number,
            first_name,
            last_name,
            status
          FROM public.patients
          WHERE
            patient_id = $1
            AND hospital_id = $2
            AND status = 'ACTIVE'
          FOR SHARE;
        `,
        [
          patientId,
          hospitalId,
        ],
      );

    if (
      patientResult.rowCount ===
      0
    ) {
      throw new Error(
        "Active patient not found for the authenticated hospital.",
      );
    }

    /*
     * The authenticated user is the consulting hospital user.
     */
    const doctorResult =
      await client.query(
        `
          SELECT
            user_id,
            hospital_id,
            full_name,
            role,
            is_active
          FROM public.hospital_users
          WHERE
            user_id = $1
            AND hospital_id = $2
            AND is_active = TRUE
          FOR SHARE;
        `,
        [
          doctorUserId,
          hospitalId,
        ],
      );

    if (
      doctorResult.rowCount ===
      0
    ) {
      throw new Error(
        "Authenticated hospital user is not active in this hospital.",
      );
    }

    /*
     * Create permanent clinical encounter.
     */
    const encounterResult =
      await client.query(
        `
          INSERT INTO public.encounters (
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
            'OPD',
            COALESCE(
              $3::timestamp,
              CURRENT_TIMESTAMP
            ),
            $4,
            'COMPLETED',
            $5,
            $6
          )
          RETURNING encounter_id;
        `,
        [
          patientId,
          hospitalId,
          visitDate,
          department,
          chiefComplaint,
          clinicalNotes,
        ],
      );

    const encounterId =
      encounterResult.rows[0]
        .encounter_id;

    /*
     * Create real OPD visit.
     */
    const opdResult =
      await client.query(
        `
          INSERT INTO public.opd_visits (
            encounter_id,
            patient_id,
            opd_number,
            doctor_user_id,
            visit_date,
            chief_complaint,
            clinical_notes,
            diagnosis_summary,
            follow_up_required,
            follow_up_date,
            status
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
            'COMPLETED'
          )
          RETURNING *;
        `,
        [
          encounterId,
          patientId,
          opdNumber,
          doctorUserId,
          visitDate,
          chiefComplaint,
          clinicalNotes,
          diagnosisSummary,
          followUpRequired,
          followUpDate,
        ],
      );

    await client.query(
      "COMMIT",
    );

    return {
      encounterId,

      opdVisit:
        opdResult.rows[0],

      patient:
        patientResult.rows[0],

      doctor:
        doctorResult.rows[0],
    };
  } catch (error) {
    await client.query(
      "ROLLBACK",
    );

    throw error;
  } finally {
    client.release();
  }
}

async function getPatientOpdHistory(
  patientId,
  hospitalId,
) {
  const normalizedPatientId =
    validatePatientId(
      patientId,
    );

  const normalizedHospitalId =
    validateHospitalId(
      hospitalId,
    );

  const result =
    await pool.query(
      `
        SELECT
          o.opd_visit_id,
          o.opd_number,
          o.visit_date,

          o.chief_complaint,
          o.clinical_notes,
          o.diagnosis_summary,

          o.follow_up_required,
          o.follow_up_date,

          o.status,

          e.encounter_id,
          e.encounter_type,
          e.department,
          e.encounter_date,
          e.status AS encounter_status,

          p.patient_id,
          p.patient_number,
          p.first_name,
          p.last_name,

          h.hospital_id,
          h.hospital_name,

          u.user_id AS doctor_id,
          u.full_name AS doctor_name

        FROM public.opd_visits o

        INNER JOIN public.encounters e
          ON o.encounter_id =
             e.encounter_id

        INNER JOIN public.patients p
          ON o.patient_id =
             p.patient_id

        INNER JOIN public.hospitals h
          ON e.hospital_id =
             h.hospital_id

        LEFT JOIN public.hospital_users u
          ON o.doctor_user_id =
             u.user_id

        WHERE
          o.patient_id = $1
          AND e.hospital_id = $2
          AND p.hospital_id = $2

        ORDER BY
          o.visit_date DESC,
          o.opd_visit_id DESC;
      `,
      [
        normalizedPatientId,
        normalizedHospitalId,
      ],
    );

  return result.rows;
}

module.exports = {
  createOpdVisit,
  getPatientOpdHistory,
};