const pool = require("../config/database");

function toPositiveInteger(value, fieldName) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(
      `${fieldName} must be a positive integer.`,
    );
  }

  return number;
}

function cleanString(value, maxLength = null) {
  if (value === undefined || value === null) {
    return "";
  }

  const text = String(value).trim();

  return maxLength
    ? text.slice(0, maxLength)
    : text;
}

function nullableString(value, maxLength = null) {
  const text = cleanString(
    value,
    maxLength,
  );

  return text || null;
}

function normalizeDate(
  value,
  fieldName,
  allowNull = true,
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    if (allowNull) {
      return null;
    }

    throw new Error(
      `${fieldName} is required.`,
    );
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      `${fieldName} is invalid.`,
    );
  }

  return parsed.toISOString();
}

function normalizePriority(value) {
  const priority =
    cleanString(value).toUpperCase() ||
    "NORMAL";

  const allowed = [
    "ROUTINE",
    "NORMAL",
    "URGENT",
    "STAT",
  ];

  if (!allowed.includes(priority)) {
    throw new Error(
      `Priority must be one of: ${allowed.join(
        ", ",
      )}.`,
    );
  }

  return priority;
}

async function getPatientInHospital(
  client,
  patientId,
  hospitalId,
) {
  const result = await client.query(
    `
      SELECT
        p.patient_id,
        p.patient_number,
        p.first_name,
        p.last_name,
        p.date_of_birth
      FROM public.patients p
      WHERE
        p.patient_id = $1
        AND p.hospital_id = $2
        AND p.status = 'ACTIVE'
        AND p.date_of_birth <=
            CURRENT_DATE - INTERVAL '18 years'
      FOR SHARE;
    `,
    [
      patientId,
      hospitalId,
    ],
  );

  if (!result.rowCount) {
    throw new Error(
      "Patient not found in the authenticated hospital.",
    );
  }

  return result.rows[0];
}

async function getEncounterInHospital(
  client,
  encounterId,
  patientId,
  hospitalId,
) {
  const result = await client.query(
    `
      SELECT
        e.encounter_id,
        e.patient_id,
        e.hospital_id,
        e.encounter_type,
        e.encounter_date,
        e.department,
        e.status
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

  if (!result.rowCount) {
    throw new Error(
      "Encounter does not belong to the selected patient and hospital.",
    );
  }

  return result.rows[0];
}

const labOrderSelect = `
  SELECT
    i.investigation_id,
    i.patient_id,
    i.encounter_id,
    i.investigation_type,
    i.investigation_name,
    i.requested_date,
    i.performed_date,
    i.result_summary,
    i.result_value,
    i.unit,
    i.reference_range,
    i.body_site,
    i.performed_by,
    i.report_reference,
    i.status,
    i.requested_by,
    i.verified_by,
    i.verified_at,
    i.priority,
    i.specimen_type,
    i.clinical_notes,

    p.patient_number,
    p.first_name,
    p.last_name,

    e.encounter_type,
    e.encounter_date,

    req.full_name AS requested_by_name,
    perf.full_name AS performed_by_name,
    ver.full_name AS verified_by_name
`;

async function getLabOrderById(
  labOrderId,
  hospitalId,
) {
  const result = await pool.query(
    `
      ${labOrderSelect}
      FROM public.investigations i

      INNER JOIN public.patients p
        ON p.patient_id = i.patient_id

      INNER JOIN public.encounters e
        ON e.encounter_id = i.encounter_id

      LEFT JOIN public.hospital_users req
        ON req.user_id = i.requested_by

      LEFT JOIN public.hospital_users perf
        ON perf.user_id = i.performed_by

      LEFT JOIN public.hospital_users ver
        ON ver.user_id = i.verified_by

      WHERE
        i.investigation_id = $1
        AND p.hospital_id = $2
        AND i.investigation_type IN (
          'LAB',
          'LABORATORY'
        )

      LIMIT 1;
    `,
    [
      labOrderId,
      hospitalId,
    ],
  );

  return result.rows[0] || null;
}

async function createLabOrder(
  data,
  authUser,
) {
  const hospitalId =
    toPositiveInteger(
      authUser?.hospitalId,
      "Authenticated hospital",
    );

  const requestedBy =
    toPositiveInteger(
      authUser?.userId,
      "Authenticated user",
    );

  const patientId =
    toPositiveInteger(
      data?.patientId,
      "patientId",
    );

  const encounterId =
    toPositiveInteger(
      data?.encounterId,
      "encounterId",
    );

  const investigationName =
    cleanString(
      data?.investigationName,
      200,
    );

  if (!investigationName) {
    throw new Error(
      "Investigation name is required.",
    );
  }

  const investigationType = (
    cleanString(
      data?.investigationType,
      40,
    ) ||
    "LABORATORY"
  ).toUpperCase();

  const priority =
    normalizePriority(
      data?.priority,
    );

  const requestedDate =
    normalizeDate(
      data?.requestedDate,
      "requestedDate",
    ) ||
    new Date().toISOString();

  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN",
    );

    await getPatientInHospital(
      client,
      patientId,
      hospitalId,
    );

    await getEncounterInHospital(
      client,
      encounterId,
      patientId,
      hospitalId,
    );

    const requestedUser =
      await client.query(
        `
          SELECT user_id
          FROM public.hospital_users
          WHERE
            user_id = $1
            AND hospital_id = $2
            AND is_active = TRUE;
        `,
        [
          requestedBy,
          hospitalId,
        ],
      );

    if (!requestedUser.rowCount) {
      throw new Error(
        "Authenticated user is not active in this hospital.",
      );
    }

    const result =
      await client.query(
        `
          INSERT INTO public.investigations (
            patient_id,
            encounter_id,
            investigation_type,
            investigation_name,
            requested_date,
            performed_date,
            result_summary,
            result_value,
            unit,
            reference_range,
            body_site,
            performed_by,
            report_reference,
            status,
            requested_by,
            verified_by,
            verified_at,
            priority,
            specimen_type,
            clinical_notes
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            'REQUESTED',
            $6,
            NULL,
            NULL,
            $7,
            $8,
            $9
          )
          RETURNING investigation_id;
        `,
        [
          patientId,
          encounterId,
          investigationType,
          investigationName,
          requestedDate,
          requestedBy,
          priority,
          nullableString(
            data?.specimenType,
            120,
          ),
          nullableString(
            data?.clinicalNotes,
          ),
        ],
      );

    await client.query(
      "COMMIT",
    );

    return getLabOrderById(
      result.rows[0]
        .investigation_id,
      hospitalId,
    );
  } catch (error) {
    await client.query(
      "ROLLBACK",
    );

    throw error;
  } finally {
    client.release();
  }
}

async function getPatientEncounters(
  patientIdValue,
  hospitalIdValue,
) {
  const patientId =
    toPositiveInteger(
      patientIdValue,
      "patientId",
    );

  const hospitalId =
    toPositiveInteger(
      hospitalIdValue,
      "Authenticated hospital",
    );

  const result =
    await pool.query(
      `
        SELECT
          e.encounter_id,
          e.patient_id,
          e.encounter_type,
          e.encounter_date,
          e.department,
          e.status,
          e.chief_complaint,
          e.notes,

          u.full_name AS attending_doctor_name,

          a.admission_id,
          a.admission_number,
          a.status AS admission_status,

          w.ward_name,
          b.bed_number

        FROM public.encounters e

        INNER JOIN public.patients p
          ON p.patient_id = e.patient_id

        LEFT JOIN public.hospital_users u
          ON u.user_id = e.attending_user_id

        LEFT JOIN public.admissions a
          ON a.encounter_id = e.encounter_id

        LEFT JOIN public.wards w
          ON w.ward_id = a.ward_id

        LEFT JOIN public.beds b
          ON b.bed_id = a.bed_id

        WHERE
          e.patient_id = $1
          AND e.hospital_id = $2
          AND p.status = 'ACTIVE'
          AND p.date_of_birth <=
              CURRENT_DATE - INTERVAL '18 years'

        ORDER BY
          e.encounter_date DESC,
          e.encounter_id DESC

        LIMIT 50;
      `,
      [
        patientId,
        hospitalId,
      ],
    );

  return result.rows;
}

async function getPatientLabOrders(
  patientIdValue,
  hospitalIdValue,
) {
  const patientId =
    toPositiveInteger(
      patientIdValue,
      "patientId",
    );

  const hospitalId =
    toPositiveInteger(
      hospitalIdValue,
      "Authenticated hospital",
    );

  const result =
    await pool.query(
      `
        ${labOrderSelect}

        FROM public.investigations i

        INNER JOIN public.patients p
          ON p.patient_id = i.patient_id

        INNER JOIN public.encounters e
          ON e.encounter_id = i.encounter_id

        LEFT JOIN public.hospital_users req
          ON req.user_id = i.requested_by

        LEFT JOIN public.hospital_users perf
          ON perf.user_id = i.performed_by

        LEFT JOIN public.hospital_users ver
          ON ver.user_id = i.verified_by

        WHERE
          i.patient_id = $1
          AND p.hospital_id = $2
          AND i.investigation_type IN (
            'LAB',
            'LABORATORY'
          )

        ORDER BY
          COALESCE(
            i.requested_date,
            i.performed_date
          ) DESC,
          i.investigation_id DESC;
      `,
      [
        patientId,
        hospitalId,
      ],
    );

  return result.rows;
}

async function recordLabResult(
  labOrderIdValue,
  data,
  authUser,
) {
  const labOrderId =
    toPositiveInteger(
      labOrderIdValue,
      "investigationId",
    );

  const hospitalId =
    toPositiveInteger(
      authUser?.hospitalId,
      "Authenticated hospital",
    );

  const performedBy =
    toPositiveInteger(
      authUser?.userId,
      "Authenticated user",
    );

  const performedDate =
    normalizeDate(
      data?.performedDate,
      "performedDate",
      false,
    );

  const resultValue =
    nullableString(
      data?.resultValue,
      500,
    );

  const resultSummary =
    nullableString(
      data?.resultSummary,
    );

  if (
    !resultValue &&
    !resultSummary
  ) {
    throw new Error(
      "Enter a result value or result summary before completing the test.",
    );
  }

  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN",
    );

    const orderResult =
      await client.query(
        `
          SELECT
            i.investigation_id,
            i.patient_id,
            i.encounter_id,
            i.status

          FROM public.investigations i

          INNER JOIN public.patients p
            ON p.patient_id = i.patient_id

          WHERE
            i.investigation_id = $1
            AND p.hospital_id = $2
            AND i.investigation_type IN (
              'LAB',
              'LABORATORY'
            )

          FOR UPDATE;
        `,
        [
          labOrderId,
          hospitalId,
        ],
      );

    if (!orderResult.rowCount) {
      throw new Error(
        "Laboratory order not found.",
      );
    }

    const order =
      orderResult.rows[0];

    if (
      order.status ===
      "CANCELLED"
    ) {
      throw new Error(
        "A cancelled laboratory order cannot receive a result.",
      );
    }

    const userResult =
      await client.query(
        `
          SELECT user_id
          FROM public.hospital_users
          WHERE
            user_id = $1
            AND hospital_id = $2
            AND is_active = TRUE;
        `,
        [
          performedBy,
          hospitalId,
        ],
      );

    if (!userResult.rowCount) {
      throw new Error(
        "Authenticated user is not active in this hospital.",
      );
    }

    const result =
      await client.query(
        `
          UPDATE public.investigations
          SET
            performed_date = $2,
            result_summary = $3,
            result_value = $4,
            unit = $5,
            reference_range = $6,
            report_reference = $7,
            performed_by = $8,
            specimen_type = $9,
            clinical_notes = $10,
            status = 'RESULTED'
          WHERE
            investigation_id = $1
          RETURNING investigation_id;
        `,
        [
          labOrderId,
          performedDate,
          resultSummary,
          resultValue,

          nullableString(
            data?.unit,
            40,
          ),

          nullableString(
            data?.referenceRange,
            100,
          ),

          nullableString(
            data?.reportReference,
            120,
          ),

          performedBy,

          nullableString(
            data?.specimenType,
            120,
          ),

          nullableString(
            data?.clinicalNotes,
          ),
        ],
      );

    await client.query(
      "COMMIT",
    );

    return getLabOrderById(
      result.rows[0]
        .investigation_id,
      hospitalId,
    );
  } catch (error) {
    await client.query(
      "ROLLBACK",
    );

    throw error;
  } finally {
    client.release();
  }
}

async function verifyLabResult(
  labOrderIdValue,
  authUser,
) {
  const labOrderId =
    toPositiveInteger(
      labOrderIdValue,
      "investigationId",
    );

  const hospitalId =
    toPositiveInteger(
      authUser?.hospitalId,
      "Authenticated hospital",
    );

  const verifiedBy =
    toPositiveInteger(
      authUser?.userId,
      "Authenticated user",
    );

  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN",
    );

    const orderResult =
      await client.query(
        `
          SELECT
            i.investigation_id,
            i.status

          FROM public.investigations i

          INNER JOIN public.patients p
            ON p.patient_id = i.patient_id

          WHERE
            i.investigation_id = $1
            AND p.hospital_id = $2
            AND i.investigation_type IN (
              'LAB',
              'LABORATORY'
            )

          FOR UPDATE;
        `,
        [
          labOrderId,
          hospitalId,
        ],
      );

    if (!orderResult.rowCount) {
      throw new Error(
        "Laboratory order not found.",
      );
    }

    const order =
      orderResult.rows[0];

    if (
      order.status !==
      "RESULTED"
    ) {
      throw new Error(
        "Only a resulted laboratory order can be verified.",
      );
    }

    const userResult =
      await client.query(
        `
          SELECT user_id
          FROM public.hospital_users
          WHERE
            user_id = $1
            AND hospital_id = $2
            AND is_active = TRUE;
        `,
        [
          verifiedBy,
          hospitalId,
        ],
      );

    if (!userResult.rowCount) {
      throw new Error(
        "Authenticated user is not active in this hospital.",
      );
    }

    const result =
      await client.query(
        `
          UPDATE public.investigations
          SET
            status = 'VERIFIED',
            verified_by = $2,
            verified_at = CURRENT_TIMESTAMP
          WHERE
            investigation_id = $1
          RETURNING investigation_id;
        `,
        [
          labOrderId,
          verifiedBy,
        ],
      );

    await client.query(
      "COMMIT",
    );

    return getLabOrderById(
      result.rows[0]
        .investigation_id,
      hospitalId,
    );
  } catch (error) {
    await client.query(
      "ROLLBACK",
    );

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createLabOrder,
  getPatientEncounters,
  getPatientLabOrders,
  getLabOrderById,
  recordLabResult,
  verifyLabResult,
};