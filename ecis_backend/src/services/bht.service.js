const pool = require("../config/database");


function cleanString(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const text =
    String(value).trim();

  return text || null;
}


function parsePositiveInteger(
  value,
  fieldName,
) {
  const parsed =
    Number(value);

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed <= 0
  ) {
    throw new Error(
      `${fieldName} must be a valid positive integer.`,
    );
  }

  return parsed;
}


function parseOptionalNumber(
  value,
  fieldName,
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    throw new Error(
      `${fieldName} must be numeric.`,
    );
  }

  return parsed;
}


function normalizeEntryDate(
  value,
) {
  if (!value) {
    return null;
  }

  const text =
    String(value).trim();

  /*
   * Preserve datetime-local
   * local hospital time.
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

  const date =
    new Date(text);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new Error(
      "entryDate is invalid.",
    );
  }

  return date.toISOString();
}


const ENTRY_TYPES = new Set([
  "ADMISSION_ASSESSMENT",
  "DAILY_PROGRESS",
  "WARD_ROUND",
  "CONSULTATION",
  "PROCEDURE_NOTE",
  "DISCHARGE_PLANNING",
]);


/* ============================================================
   CREATE BHT ENTRY
   ============================================================ */

async function createBhtEntry(
  data,
) {
  const admissionId =
    parsePositiveInteger(
      data.admissionId,
      "admissionId",
    );

  const hospitalId =
    parsePositiveInteger(
      data.hospitalId,
      "hospitalId",
    );

  const recordedBy =
    parsePositiveInteger(
      data.recordedBy,
      "recordedBy",
    );

  const entryType =
    cleanString(
      data.entryType,
    );

  if (
    !ENTRY_TYPES.has(
      entryType,
    )
  ) {
    throw new Error(
      "Invalid BHT entry type.",
    );
  }

  const entryTitle =
    cleanString(
      data.entryTitle,
    );

  const subjectiveNotes =
    cleanString(
      data.subjectiveNotes,
    );

  const objectiveNotes =
    cleanString(
      data.objectiveNotes,
    );

  const assessment =
    cleanString(
      data.assessment,
    );

  const plan =
    cleanString(
      data.plan,
    );

  const diagnosis =
    cleanString(
      data.diagnosis,
    );

  const entryDate =
    normalizeEntryDate(
      data.entryDate,
    );

  const temperature =
    parseOptionalNumber(
      data.temperatureC,
      "temperatureC",
    );

  const pulse =
    parseOptionalNumber(
      data.pulseBpm,
      "pulseBpm",
    );

  const respiratoryRate =
    parseOptionalNumber(
      data.respiratoryRateBpm,
      "respiratoryRateBpm",
    );

  const systolicBp =
    parseOptionalNumber(
      data.systolicBp,
      "systolicBp",
    );

  const diastolicBp =
    parseOptionalNumber(
      data.diastolicBp,
      "diastolicBp",
    );

  const spo2 =
    parseOptionalNumber(
      data.spo2Percent,
      "spo2Percent",
    );

  const painScore =
    parseOptionalNumber(
      data.painScore,
      "painScore",
    );

  const weightKg =
    parseOptionalNumber(
      data.weightKg,
      "weightKg",
    );

  if (
    !assessment &&
    !plan &&
    !diagnosis &&
    !subjectiveNotes &&
    !objectiveNotes
  ) {
    throw new Error(
      "At least one clinical note, assessment, plan or diagnosis is required.",
    );
  }

  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN",
    );


    /*
     * Lock the admission.
     *
     * BHT entries are only allowed while the
     * inpatient admission is active.
     */
    const admissionResult =
      await client.query(
        `
          SELECT
            a.admission_id,
            a.patient_id,
            a.encounter_id,
            a.ward_id,
            a.bed_id,
            a.admission_number,
            a.status,

            w.hospital_id,
            w.ward_code,
            w.ward_name,
            w.ward_type,

            e.status AS encounter_status

          FROM public.admissions a

          INNER JOIN public.wards w
            ON w.ward_id =
               a.ward_id

          INNER JOIN public.encounters e
            ON e.encounter_id =
               a.encounter_id

          WHERE
            a.admission_id = $1
            AND w.hospital_id = $2

          FOR UPDATE OF a;
        `,
        [
          admissionId,
          hospitalId,
        ],
      );


    if (
      admissionResult.rowCount ===
      0
    ) {
      throw new Error(
        "Admission not found for the authenticated hospital.",
      );
    }


    const admission =
      admissionResult.rows[0];


    if (
      admission.status !==
      "ADMITTED"
    ) {
      throw new Error(
        `BHT entry cannot be recorded because the admission is ${admission.status}.`,
      );
    }


    /*
     * The inpatient encounter should still
     * be open while treatment continues.
     */
    if (
      admission.encounter_status !==
      "OPEN"
    ) {
      throw new Error(
        `BHT entry cannot be recorded because the encounter is ${admission.encounter_status}.`,
      );
    }


    /*
     * Verify authenticated recorder.
     */
    const userResult =
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
          recordedBy,
          hospitalId,
        ],
      );


    if (
      userResult.rowCount ===
      0
    ) {
      throw new Error(
        "Authenticated hospital user is not active in this hospital.",
      );
    }


    const recordedUser =
      userResult.rows[0];


    if (
      recordedUser.role &&
      String(
        recordedUser.role,
      ).toUpperCase() !==
        "DOCTOR"
    ) {
      throw new Error(
        "Only an authenticated doctor can create a BHT clinical entry.",
      );
    }


    const result =
      await client.query(
        `
          INSERT INTO public.bht_entries (
            admission_id,
            encounter_id,
            patient_id,
            hospital_id,

            entry_type,
            entry_date,
            entry_title,

            subjective_notes,
            objective_notes,
            assessment,
            plan,
            diagnosis,

            temperature_c,
            pulse_bpm,
            respiratory_rate_bpm,
            systolic_bp,
            diastolic_bp,
            spo2_percent,
            pain_score,
            weight_kg,

            recorded_by
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
            $14,
            $15,
            $16,
            $17,
            $18,
            $19,
            $20,

            $21
          )
          RETURNING *;
        `,
        [
          admission.admission_id,
          admission.encounter_id,
          admission.patient_id,
          hospitalId,

          entryType,
          entryDate,
          entryTitle,

          subjectiveNotes,
          objectiveNotes,
          assessment,
          plan,
          diagnosis,

          temperature,
          pulse,
          respiratoryRate,
          systolicBp,
          diastolicBp,
          spo2,
          painScore,
          weightKg,

          recordedBy,
        ],
      );


    await client.query(
      "COMMIT",
    );


    return {
      entry:
        result.rows[0],

      admission: {
        admissionId:
          admission.admission_id,

        admissionNumber:
          admission.admission_number,

        status:
          admission.status,

        wardCode:
          admission.ward_code,

        wardName:
          admission.ward_name,

        wardType:
          admission.ward_type,
      },

      recordedBy: {
        userId:
          recordedUser.user_id,

        name:
          recordedUser.full_name,

        role:
          recordedUser.role,
      },
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
   GET BHT FOR ADMISSION
   ============================================================ */

async function getAdmissionBhtEntries(
  admissionId,
  hospitalId,
) {
  const normalizedAdmissionId =
    parsePositiveInteger(
      admissionId,
      "admissionId",
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
          b.bht_entry_id,

          b.admission_id,
          a.admission_number,

          b.encounter_id,

          b.patient_id,
          p.patient_number,
          p.first_name,
          p.last_name,

          b.hospital_id,
          h.hospital_name,

          b.entry_type,
          b.entry_date,
          b.entry_title,

          b.subjective_notes,
          b.objective_notes,
          b.assessment,
          b.plan,
          b.diagnosis,

          b.temperature_c,
          b.pulse_bpm,
          b.respiratory_rate_bpm,
          b.systolic_bp,
          b.diastolic_bp,
          b.spo2_percent,
          b.pain_score,
          b.weight_kg,

          b.recorded_by,
          u.full_name AS recorded_by_name,

          w.ward_code,
          w.ward_name,
          w.ward_type

        FROM public.bht_entries b

        INNER JOIN public.admissions a
          ON a.admission_id =
             b.admission_id

        INNER JOIN public.patients p
          ON p.patient_id =
             b.patient_id

        INNER JOIN public.hospitals h
          ON h.hospital_id =
             b.hospital_id

        INNER JOIN public.hospital_users u
          ON u.user_id =
             b.recorded_by

        INNER JOIN public.wards w
          ON w.ward_id =
             a.ward_id

        WHERE
          b.admission_id = $1
          AND b.hospital_id = $2

        ORDER BY
          b.entry_date DESC,
          b.bht_entry_id DESC;
      `,
      [
        normalizedAdmissionId,
        normalizedHospitalId,
      ],
    );

  return result.rows;
}


/* ============================================================
   GET PATIENT BHT HISTORY
   ============================================================ */

async function getPatientBhtHistory(
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
        SELECT *
        FROM public.vw_bht_clinical_timeline
        WHERE
          patient_id = $1
          AND hospital_id = $2
        ORDER BY
          entry_date DESC,
          bht_entry_id DESC;
      `,
      [
        normalizedPatientId,
        normalizedHospitalId,
      ],
    );

  return result.rows;
}


module.exports = {
  createBhtEntry,
  getAdmissionBhtEntries,
  getPatientBhtHistory,
};