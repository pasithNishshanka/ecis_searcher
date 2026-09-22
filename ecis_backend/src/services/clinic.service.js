const pool = require("../config/database");

function cleanString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();

  return text || null;
}

function parsePositiveInteger(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `${fieldName} must be a valid positive integer.`,
    );
  }

  return parsed;
}

function parseBoolean(value, defaultValue = false) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
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
    String(value)
      .trim()
      .toLowerCase(),
  );
}

function normalizeDate(
  value,
  fieldName,
) {
  if (!value) {
    return null;
  }

  const text =
    String(value).trim();

  /*
   * datetime-local values arrive without a timezone:
   *
   * 2026-09-22T20:30
   *
   * PostgreSQL uses TIMESTAMP columns in this project,
   * so preserve the entered local clock time instead
   * of converting it to UTC.
   */
  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(
      text,
    )
  ) {
    return (
      text.replace(
        "T",
        " ",
      ) + ":00"
    );
  }

  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(
      text,
    )
  ) {
    return text.replace(
      "T",
      " ",
    );
  }

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      text,
    )
  ) {
    return `${text} 00:00:00`;
  }

  const date =
    new Date(text);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new Error(
      `${fieldName} is invalid.`,
    );
  }

  return date.toISOString();
}

function buildClinicVisitNumber(
  clinicCode,
) {
  const prefix =
    String(
      clinicCode ||
        "CLINIC",
    )
      .trim()
      .toUpperCase()
      .replace(
        /[^A-Z0-9]+/g,
        "-",
      )
      .slice(0, 12);

  const datePart =
    new Date()
      .toISOString()
      .slice(0, 10)
      .replace(
        /-/g,
        "",
      );

  return `${prefix}-${datePart}-${Date.now()}`;
}


/* ============================================================
   CREATE CLINIC
   ============================================================ */

async function createClinic(
  clinicData,
) {
  const hospitalId =
    parsePositiveInteger(
      clinicData.hospitalId,
      "hospitalId",
    );

  const clinicCode =
    cleanString(
      clinicData.clinicCode,
    );

  const clinicName =
    cleanString(
      clinicData.clinicName,
    );

  const specialty =
    cleanString(
      clinicData.specialty,
    );

  const location =
    cleanString(
      clinicData.location,
    );

  if (!clinicCode) {
    throw new Error(
      "clinicCode is required.",
    );
  }

  if (!clinicName) {
    throw new Error(
      "clinicName is required.",
    );
  }

  const result =
    await pool.query(
      `
        INSERT INTO public.clinics (
          hospital_id,
          clinic_code,
          clinic_name,
          specialty,
          location
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5
        )
        RETURNING *;
      `,
      [
        hospitalId,
        clinicCode,
        clinicName,
        specialty,
        location,
      ],
    );

  return result.rows[0];
}


/* ============================================================
   GET ACTIVE CLINICS
   ============================================================ */

async function getClinicsByHospital(
  hospitalId,
) {
  const normalizedHospitalId =
    parsePositiveInteger(
      hospitalId,
      "hospitalId",
    );

  const result =
    await pool.query(
      `
        SELECT
          clinic_id,
          hospital_id,
          clinic_code,
          clinic_name,
          specialty,
          location,
          is_active,
          created_at,
          updated_at
        FROM public.clinics
        WHERE
          hospital_id = $1
          AND is_active = TRUE
        ORDER BY
          clinic_name ASC,
          clinic_id ASC;
      `,
      [
        normalizedHospitalId,
      ],
    );

  return result.rows;
}


/* ============================================================
   CREATE CLINIC VISIT
   ============================================================ */

async function createClinicVisit(
  visitData,
) {
  const clinicId =
    parsePositiveInteger(
      visitData.clinicId,
      "clinicId",
    );

  const patientId =
    parsePositiveInteger(
      visitData.patientId,
      "patientId",
    );

  const hospitalId =
    parsePositiveInteger(
      visitData.hospitalId,
      "hospitalId",
    );

  const doctorUserId =
    parsePositiveInteger(
      visitData.doctorUserId,
      "doctorUserId",
    );

  const visitDate =
    normalizeDate(
      visitData.visitDate,
      "visitDate",
    );

  const reasonForVisit =
    cleanString(
      visitData.reasonForVisit,
    );

  const clinicalNotes =
    cleanString(
      visitData.clinicalNotes,
    );

  const diagnosisSummary =
    cleanString(
      visitData.diagnosisSummary,
    );

  const followUpRequired =
    parseBoolean(
      visitData.followUpRequired,
      false,
    );

  const followUpDate =
    visitData.followUpRequired
      ? normalizeDate(
          visitData.followUpDate,
          "followUpDate",
        )
      : null;

  const requestedVisitNumber =
    cleanString(
      visitData.visitNumber,
    );

  if (!reasonForVisit) {
    throw new Error(
      "Reason for visit is required.",
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
     * Verify clinic belongs to authenticated hospital.
     */
    const clinicResult =
      await client.query(
        `
          SELECT
            clinic_id,
            hospital_id,
            clinic_code,
            clinic_name,
            specialty,
            location
          FROM public.clinics
          WHERE
            clinic_id = $1
            AND hospital_id = $2
            AND is_active = TRUE
          FOR SHARE;
        `,
        [
          clinicId,
          hospitalId,
        ],
      );

    if (
      clinicResult.rowCount ===
      0
    ) {
      throw new Error(
        "Clinic not found for the authenticated hospital.",
      );
    }

    const clinic =
      clinicResult.rows[0];

    /*
     * Verify patient belongs to the same hospital.
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
     * Authenticated clinician.
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
        "Authenticated clinician is not active in this hospital.",
      );
    }

    const doctor =
      doctorResult.rows[0];

    if (
      doctor.role &&
      String(
        doctor.role,
      ).toUpperCase() !==
        "DOCTOR"
    ) {
      throw new Error(
        "Only a doctor can complete a clinic consultation.",
      );
    }

    /*
     * Create the clinical encounter.
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
            'CLINIC',
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
          clinic.specialty ||
            clinic.clinic_name,
          reasonForVisit,
          clinicalNotes,
        ],
      );

    const encounterId =
      encounterResult.rows[0]
        .encounter_id;

    const visitNumber =
      requestedVisitNumber ||
      buildClinicVisitNumber(
        clinic.clinic_code,
      );

    /*
     * Create the specialty-clinic visit.
     */
    const visitResult =
      await client.query(
        `
          INSERT INTO public.clinic_visits (
            clinic_id,
            encounter_id,
            patient_id,
            visit_number,
            visit_date,
            doctor_user_id,
            reason_for_visit,
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
            $11,
            'COMPLETED'
          )
          RETURNING *;
        `,
        [
          clinicId,
          encounterId,
          patientId,
          visitNumber,
          visitDate,
          doctorUserId,
          reasonForVisit,
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

      clinic: {
        clinicId:
          clinic.clinic_id,

        clinicCode:
          clinic.clinic_code,

        clinicName:
          clinic.clinic_name,

        specialty:
          clinic.specialty,

        location:
          clinic.location,
      },

      patient:
        patientResult.rows[0],

      doctor:
        doctorResult.rows[0],

      clinicVisit:
        visitResult.rows[0],
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


/* ============================================================
   PATIENT CLINIC HISTORY
   ============================================================ */

async function getPatientClinicHistory(
  patientId,
  hospitalId,
) {
  const normalizedPatientId =
    parsePositiveInteger(
      patientId,
      "patientId",
    );

  const normalizedHospitalId =
    parsePositiveInteger(
      hospitalId,
      "hospitalId",
    );

  const result =
    await pool.query(
      `
        SELECT
          cv.clinic_visit_id,
          cv.visit_number,
          cv.visit_date,

          cv.reason_for_visit,
          cv.clinical_notes,
          cv.diagnosis_summary,

          cv.follow_up_required,
          cv.follow_up_date,

          cv.status,

          c.clinic_id,
          c.clinic_code,
          c.clinic_name,
          c.specialty,
          c.location,

          e.encounter_id,
          e.encounter_type,
          e.encounter_date,
          e.department,
          e.status AS encounter_status,

          p.patient_id,
          p.patient_number,
          p.first_name,
          p.last_name,

          u.user_id AS doctor_id,
          u.full_name AS doctor_name,

          h.hospital_id,
          h.hospital_name

        FROM public.clinic_visits cv

        INNER JOIN public.clinics c
          ON cv.clinic_id =
             c.clinic_id

        INNER JOIN public.encounters e
          ON cv.encounter_id =
             e.encounter_id

        INNER JOIN public.patients p
          ON cv.patient_id =
             p.patient_id

        LEFT JOIN public.hospital_users u
          ON cv.doctor_user_id =
             u.user_id

        INNER JOIN public.hospitals h
          ON c.hospital_id =
             h.hospital_id

        WHERE
          cv.patient_id = $1
          AND c.hospital_id = $2
          AND p.hospital_id = $2
          AND e.hospital_id = $2

        ORDER BY
          cv.visit_date DESC,
          cv.clinic_visit_id DESC;
      `,
      [
        normalizedPatientId,
        normalizedHospitalId,
      ],
    );

  return result.rows;
}


module.exports = {
  createClinic,
  getClinicsByHospital,
  createClinicVisit,
  getPatientClinicHistory,
};