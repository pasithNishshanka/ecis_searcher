const pool = require("../config/database");

function nullablePositiveInteger(value, fieldName) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed <= 0
  ) {
    throw new Error(
      `${fieldName} must be a positive integer`,
    );
  }

  return parsed;
}

function requiredText(value, fieldName) {
  const text =
    String(value ?? "").trim();

  if (!text) {
    throw new Error(
      `${fieldName} is required`,
    );
  }

  return text;
}

function nullableText(value) {
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

function parseClinicalDate(
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
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    throw new Error(
      `${fieldName} is invalid`,
    );
  }

  if (
    parsed.getTime() >
    Date.now()
  ) {
    throw new Error(
      `${fieldName} cannot be in the future`,
    );
  }

  return value;
}

async function validateClinicalContext(
  client,
  {
    patientId,
    hospitalId,
    encounterId,
    admissionId,
    requireEncounter = true,
  },
) {
  const patientResult =
    await client.query(
      `
        SELECT
          patient_id,
          hospital_id,
          status
        FROM public.patients
        WHERE
          patient_id = $1
          AND hospital_id = $2
        FOR SHARE;
      `,
      [
        patientId,
        hospitalId,
      ],
    );

  if (
    patientResult.rowCount === 0
  ) {
    throw new Error(
      "Active patient not found for the authenticated hospital",
    );
  }

  const patient =
    patientResult.rows[0];

  if (
    patient.status !==
    "ACTIVE"
  ) {
    throw new Error(
      "The selected patient is not active",
    );
  }

  if (
    requireEncounter &&
    !encounterId
  ) {
    throw new Error(
      "encounterId is required for a surgery record",
    );
  }

  let encounter =
    null;

  let admission =
    null;

  if (encounterId) {
    const encounterResult =
      await client.query(
        `
          SELECT
            e.encounter_id,
            e.patient_id,
            e.hospital_id,
            e.encounter_type,
            e.encounter_date,
            e.department,
            e.status,
            e.chief_complaint,
            e.notes
          FROM public.encounters e
          WHERE
            e.encounter_id = $1
            AND e.patient_id = $2
            AND e.hospital_id = $3
          FOR SHARE;
        `,
        [
          encounterId,
          patientId,
          hospitalId,
        ],
      );

    if (
      encounterResult.rowCount ===
      0
    ) {
      throw new Error(
        "Selected encounter does not belong to the selected patient",
      );
    }

    encounter =
      encounterResult.rows[0];
  }

  if (admissionId) {
    const admissionResult =
      await client.query(
        `
          SELECT
            a.admission_id,
            a.patient_id,
            a.encounter_id,
            a.admission_number,
            a.admission_date,
            a.status,
            a.ward_id,
            w.ward_name
          FROM public.admissions a
          INNER JOIN public.wards w
            ON w.ward_id = a.ward_id
          WHERE
            a.admission_id = $1
            AND a.patient_id = $2
            AND w.hospital_id = $3
          FOR SHARE;
        `,
        [
          admissionId,
          patientId,
          hospitalId,
        ],
      );

    if (
      admissionResult.rowCount ===
      0
    ) {
      throw new Error(
        "Selected admission does not belong to the selected patient",
      );
    }

    admission =
      admissionResult.rows[0];

    if (
      encounter &&
      admission.encounter_id !==
        encounter.encounter_id
    ) {
      throw new Error(
        "Selected admission is not linked to the selected encounter",
      );
    }
  } else if (encounterId) {
    const admissionResult =
      await client.query(
        `
          SELECT
            a.admission_id,
            a.patient_id,
            a.encounter_id,
            a.admission_number,
            a.admission_date,
            a.status,
            a.ward_id,
            w.ward_name
          FROM public.admissions a
          INNER JOIN public.wards w
            ON w.ward_id = a.ward_id
          WHERE
            a.encounter_id = $1
            AND a.patient_id = $2
            AND w.hospital_id = $3
          ORDER BY
            a.admission_id DESC
          LIMIT 1;
        `,
        [
          encounterId,
          patientId,
          hospitalId,
        ],
      );

    admission =
      admissionResult.rows[0] ||
      null;
  }

  return {
    patient,
    encounter,
    admission,
  };
}

async function validateRecordingUser(
  client,
  {
    userId,
    hospitalId,
  },
) {
  const result =
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
        LIMIT 1;
      `,
      [
        userId,
        hospitalId,
      ],
    );

  if (
    result.rowCount === 0 ||
    !result.rows[0].is_active
  ) {
    throw new Error(
      "Authenticated clinical user was not found",
    );
  }

  const user =
    result.rows[0];

  if (
    String(
      user.role || "",
    )
      .trim()
      .toUpperCase() !==
    "DOCTOR"
  ) {
    throw new Error(
      "Only an authenticated doctor can record surgery",
    );
  }

  return user;
}

async function createSurgery(
  surgeryData,
) {
  const patientId =
    nullablePositiveInteger(
      surgeryData.patientId,
      "patientId",
    );

  const hospitalId =
    nullablePositiveInteger(
      surgeryData.hospitalId,
      "hospitalId",
    );

  const encounterId =
    nullablePositiveInteger(
      surgeryData.encounterId,
      "encounterId",
    );

  const admissionId =
    nullablePositiveInteger(
      surgeryData.admissionId,
      "admissionId",
    );

  const userId =
    nullablePositiveInteger(
      surgeryData.surgeonUserId,
      "surgeonUserId",
    );

  const surgeryName =
    requiredText(
      surgeryData.surgeryName,
      "surgeryName",
    );

  const surgeryDate =
    parseClinicalDate(
      surgeryData.surgeryDate,
      "surgeryDate",
    );

  if (
    !patientId ||
    !hospitalId ||
    !userId
  ) {
    throw new Error(
      "Authenticated surgery context is incomplete",
    );
  }

  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN",
    );

    await validateRecordingUser(
      client,
      {
        userId,
        hospitalId,
      },
    );

    const context =
      await validateClinicalContext(
        client,
        {
          patientId,
          hospitalId,
          encounterId,
          admissionId,
          requireEncounter: true,
        },
      );

    const result =
      await client.query(
        `
          INSERT INTO public.surgeries (
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
          encounterId,
          context.admission
            ?.admission_id ??
            admissionId,
          nullableText(
            surgeryData.surgeryCode,
          ),
          surgeryName,
          surgeryDate,
          nullableText(
            surgeryData.bodySite,
          ),
          nullableText(
            surgeryData.laterality,
          ),
          userId,
          nullableText(
            surgeryData.preoperativeDiagnosis,
          ),
          nullableText(
            surgeryData.postoperativeDiagnosis,
          ),
          nullableText(
            surgeryData.findings,
          ),
          nullableText(
            surgeryData.complications,
          ),
          nullableText(
            surgeryData.surgicalNotes,
          ),
        ],
      );

    await client.query(
      "COMMIT",
    );

    return {
      surgery:
        result.rows[0],
      encounter:
        context.encounter,
      admission:
        context.admission,
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

async function getPatientClinicalContext(
  patientIdValue,
  hospitalIdValue,
) {
  const patientId =
    nullablePositiveInteger(
      patientIdValue,
      "patientId",
    );

  const hospitalId =
    nullablePositiveInteger(
      hospitalIdValue,
      "hospitalId",
    );

  if (
    !patientId ||
    !hospitalId
  ) {
    throw new Error(
      "Patient context is incomplete",
    );
  }

  const patientResult =
    await pool.query(
      `
        SELECT
          patient_id,
          patient_number,
          first_name,
          middle_name,
          last_name,
          date_of_birth,
          gender,
          hospital_id,
          status
        FROM public.patients
        WHERE
          patient_id = $1
          AND hospital_id = $2
        LIMIT 1;
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
      "Patient not found for the authenticated hospital",
    );
  }

  const encountersResult =
    await pool.query(
      `
        SELECT
          e.encounter_id,
          e.encounter_type,
          e.encounter_date,
          e.department,
          e.status,
          e.chief_complaint,
          e.notes,
          a.admission_id,
          a.admission_number,
          a.admission_date,
          a.status AS admission_status,
          w.ward_name
        FROM public.encounters e
        LEFT JOIN public.admissions a
          ON a.encounter_id = e.encounter_id
         AND a.patient_id = e.patient_id
        LEFT JOIN public.wards w
          ON w.ward_id = a.ward_id
        WHERE
          e.patient_id = $1
          AND e.hospital_id = $2
        ORDER BY
          e.encounter_date DESC,
          e.encounter_id DESC;
      `,
      [
        patientId,
        hospitalId,
      ],
    );

  return {
    patient:
      patientResult.rows[0],
    encounters:
      encountersResult.rows,
  };
}

async function getPatientSurgeries(
  patientIdValue,
  hospitalIdValue,
) {
  const patientId =
    nullablePositiveInteger(
      patientIdValue,
      "patientId",
    );

  const hospitalId =
    nullablePositiveInteger(
      hospitalIdValue,
      "hospitalId",
    );

  if (
    !patientId ||
    !hospitalId
  ) {
    throw new Error(
      "Patient context is incomplete",
    );
  }

  const result =
    await pool.query(
      `
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
          e.encounter_type,
          e.department,
          e.status AS encounter_status,
          a.admission_number,
          a.status AS admission_status,
          w.ward_name,
          u.user_id AS surgeon_id,
          u.full_name AS surgeon_name
        FROM public.surgeries s
        INNER JOIN public.patients p
          ON p.patient_id = s.patient_id
         AND p.hospital_id = $2
        LEFT JOIN public.encounters e
          ON e.encounter_id = s.encounter_id
         AND e.patient_id = s.patient_id
        LEFT JOIN public.admissions a
          ON a.admission_id = s.admission_id
         AND a.patient_id = s.patient_id
        LEFT JOIN public.wards w
          ON w.ward_id = a.ward_id
        LEFT JOIN public.hospital_users u
          ON u.user_id = s.surgeon_user_id
        WHERE
          s.patient_id = $1
        ORDER BY
          s.surgery_date DESC,
          s.surgery_id DESC;
      `,
      [
        patientId,
        hospitalId,
      ],
    );

  return result.rows;
}

async function getSurgeryById(
  surgeryIdValue,
  hospitalIdValue,
) {
  const surgeryId =
    nullablePositiveInteger(
      surgeryIdValue,
      "surgeryId",
    );

  const hospitalId =
    nullablePositiveInteger(
      hospitalIdValue,
      "hospitalId",
    );

  if (
    !surgeryId ||
    !hospitalId
  ) {
    throw new Error(
      "Surgery context is incomplete",
    );
  }

  const result =
    await pool.query(
      `
        SELECT
          s.*,
          p.patient_number,
          p.first_name,
          p.middle_name,
          p.last_name,
          e.encounter_type,
          e.encounter_date,
          e.department,
          a.admission_number,
          a.status AS admission_status,
          w.ward_name,
          u.full_name AS surgeon_name
        FROM public.surgeries s
        INNER JOIN public.patients p
          ON p.patient_id = s.patient_id
         AND p.hospital_id = $2
        LEFT JOIN public.encounters e
          ON e.encounter_id = s.encounter_id
        LEFT JOIN public.admissions a
          ON a.admission_id = s.admission_id
        LEFT JOIN public.wards w
          ON w.ward_id = a.ward_id
        LEFT JOIN public.hospital_users u
          ON u.user_id = s.surgeon_user_id
        WHERE
          s.surgery_id = $1;
      `,
      [
        surgeryId,
        hospitalId,
      ],
    );

  return result.rows[0] ||
    null;
}

module.exports = {
  createSurgery,
  getPatientClinicalContext,
  getPatientSurgeries,
  getSurgeryById,
};