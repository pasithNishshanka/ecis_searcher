const pool = require("../config/database");

function positiveInteger(value, fieldName) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(
      `${fieldName} must be a positive integer.`,
    );
  }

  return number;
}

function cleanString(
  value,
  maxLength = null,
) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  const text =
    String(value).trim();

  return maxLength
    ? text.slice(
        0,
        maxLength,
      )
    : text;
}

function nullableString(
  value,
  maxLength = null,
) {
  const text =
    cleanString(
      value,
      maxLength,
    );

  return text || null;
}

function parseDate(
  value,
  fieldName,
  required = false,
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    if (required) {
      throw new Error(
        `${fieldName} is required.`,
      );
    }

    return null;
  }

  const date =
    new Date(value);

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

function normalizePriority(value) {
  const priority =
    (
      cleanString(value) ||
      "NORMAL"
    ).toUpperCase();

  const allowed = [
    "ROUTINE",
    "NORMAL",
    "URGENT",
    "STAT",
  ];

  if (
    !allowed.includes(priority)
  ) {
    throw new Error(
      `Priority must be one of: ${allowed.join(", ")}.`,
    );
  }

  return priority;
}

const imagingOrderSelect = `
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
    e.status AS encounter_status,

    req.full_name AS requested_by_name,
    perf.full_name AS performed_by_name,
    ver.full_name AS verified_by_name
`;

async function assertPatient(
  client,
  patientId,
  hospitalId,
) {
  const result =
    await client.query(
      `
        SELECT
          p.patient_id,
          p.patient_number,
          p.first_name,
          p.last_name
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

async function assertEncounter(
  client,
  encounterId,
  patientId,
  hospitalId,
) {
  const result =
    await client.query(
      `
        SELECT
          encounter_id,
          patient_id,
          hospital_id,
          encounter_type,
          encounter_date,
          status
        FROM public.encounters
        WHERE
          encounter_id = $1
          AND patient_id = $2
          AND hospital_id = $3
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

async function assertActiveUser(
  client,
  userId,
  hospitalId,
) {
  const result =
    await client.query(
      `
        SELECT
          user_id,
          full_name
        FROM public.hospital_users
        WHERE
          user_id = $1
          AND hospital_id = $2
          AND is_active = TRUE;
      `,
      [
        userId,
        hospitalId,
      ],
    );

  if (!result.rowCount) {
    throw new Error(
      "Authenticated user is not active in this hospital.",
    );
  }

  return result.rows[0];
}

async function getOrderById(
  orderIdValue,
  hospitalIdValue,
) {
  const orderId =
    positiveInteger(
      orderIdValue,
      "investigationId",
    );

  const hospitalId =
    positiveInteger(
      hospitalIdValue,
      "Authenticated hospital",
    );

  const result =
    await pool.query(
      `
        ${imagingOrderSelect}

        FROM public.investigations i

        INNER JOIN public.patients p
          ON p.patient_id =
             i.patient_id

        INNER JOIN public.encounters e
          ON e.encounter_id =
             i.encounter_id

        LEFT JOIN public.hospital_users req
          ON req.user_id =
             i.requested_by

        LEFT JOIN public.hospital_users perf
          ON perf.user_id =
             i.performed_by

        LEFT JOIN public.hospital_users ver
          ON ver.user_id =
             i.verified_by

        WHERE
          i.investigation_id = $1
          AND p.hospital_id = $2
          AND i.investigation_type =
              'IMAGING'

        LIMIT 1;
      `,
      [
        orderId,
        hospitalId,
      ],
    );

  return result.rows[0] || null;
}

async function getPatientEncounters(
  patientIdValue,
  hospitalIdValue,
) {
  const patientId =
    positiveInteger(
      patientIdValue,
      "patientId",
    );

  const hospitalId =
    positiveInteger(
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
          e.status,

          a.admission_id,
          a.admission_number,
          a.status AS admission_status,

          w.ward_name,
          b.bed_number

        FROM public.encounters e

        INNER JOIN public.patients p
          ON p.patient_id =
             e.patient_id

        LEFT JOIN public.admissions a
          ON a.encounter_id =
             e.encounter_id

        LEFT JOIN public.wards w
          ON w.ward_id =
             a.ward_id

        LEFT JOIN public.beds b
          ON b.bed_id =
             a.bed_id

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

async function getPatientOrders(
  patientIdValue,
  hospitalIdValue,
) {
  const patientId =
    positiveInteger(
      patientIdValue,
      "patientId",
    );

  const hospitalId =
    positiveInteger(
      hospitalIdValue,
      "Authenticated hospital",
    );

  const result =
    await pool.query(
      `
        ${imagingOrderSelect}

        FROM public.investigations i

        INNER JOIN public.patients p
          ON p.patient_id =
             i.patient_id

        INNER JOIN public.encounters e
          ON e.encounter_id =
             i.encounter_id

        LEFT JOIN public.hospital_users req
          ON req.user_id =
             i.requested_by

        LEFT JOIN public.hospital_users perf
          ON perf.user_id =
             i.performed_by

        LEFT JOIN public.hospital_users ver
          ON ver.user_id =
             i.verified_by

        WHERE
          i.patient_id = $1
          AND p.hospital_id = $2
          AND i.investigation_type =
              'IMAGING'

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

async function createOrder(
  data,
  authUser,
) {
  const hospitalId =
    positiveInteger(
      authUser?.hospitalId,
      "Authenticated hospital",
    );

  const requestedBy =
    positiveInteger(
      authUser?.userId,
      "Authenticated user",
    );

  const patientId =
    positiveInteger(
      data?.patientId,
      "patientId",
    );

  const encounterId =
    positiveInteger(
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
      "Imaging investigation name is required.",
    );
  }

  const requestedDate =
    parseDate(
      data?.requestedDate,
      "requestedDate",
    ) ||
    new Date().toISOString();

  const priority =
    normalizePriority(
      data?.priority,
    );

  const bodySite =
    nullableString(
      data?.bodySite,
      160,
    );

  const clinicalNotes =
    nullableString(
      data?.clinicalNotes,
    );

  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN",
    );

    await assertPatient(
      client,
      patientId,
      hospitalId,
    );

    await assertEncounter(
      client,
      encounterId,
      patientId,
      hospitalId,
    );

    await assertActiveUser(
      client,
      requestedBy,
      hospitalId,
    );

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
            'IMAGING',
            $3,
            $4,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            $5,
            NULL,
            NULL,
            'REQUESTED',
            $6,
            NULL,
            NULL,
            $7,
            NULL,
            $8
          )
          RETURNING investigation_id;
        `,
        [
          patientId,
          encounterId,
          investigationName,
          requestedDate,
          bodySite,
          requestedBy,
          priority,
          clinicalNotes,
        ],
      );

    await client.query(
      "COMMIT",
    );

    return getOrderById(
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

async function recordReport(
  orderIdValue,
  data,
  authUser,
) {
  const orderId =
    positiveInteger(
      orderIdValue,
      "investigationId",
    );

  const hospitalId =
    positiveInteger(
      authUser?.hospitalId,
      "Authenticated hospital",
    );

  const performedBy =
    positiveInteger(
      authUser?.userId,
      "Authenticated user",
    );

  const performedDate =
    parseDate(
      data?.performedDate,
      "performedDate",
      true,
    );

  const reportText =
    nullableString(
      data?.reportText,
    );

  if (!reportText) {
    throw new Error(
      "Radiology findings / impression are required.",
    );
  }

  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN",
    );

    const existing =
      await client.query(
        `
          SELECT
            i.investigation_id,
            i.status

          FROM public.investigations i

          INNER JOIN public.patients p
            ON p.patient_id =
               i.patient_id

          WHERE
            i.investigation_id = $1
            AND p.hospital_id = $2
            AND i.investigation_type =
                'IMAGING'

          FOR UPDATE;
        `,
        [
          orderId,
          hospitalId,
        ],
      );

    if (!existing.rowCount) {
      throw new Error(
        "Radiology order not found.",
      );
    }

    if (
      existing.rows[0].status ===
      "CANCELLED"
    ) {
      throw new Error(
        "A cancelled radiology order cannot receive a report.",
      );
    }

    await assertActiveUser(
      client,
      performedBy,
      hospitalId,
    );

    const result =
      await client.query(
        `
          UPDATE public.investigations
          SET
            performed_date = $2,
            result_summary = $3,
            report_reference = $4,
            performed_by = $5,
            status = 'RESULTED',
            clinical_notes =
              COALESCE(
                $6,
                clinical_notes
              )

          WHERE
            investigation_id = $1

          RETURNING investigation_id;
        `,
        [
          orderId,
          performedDate,
          reportText,
          nullableString(
            data?.reportReference,
            120,
          ),
          performedBy,
          nullableString(
            data?.clinicalNotes,
          ),
        ],
      );

    await client.query(
      "COMMIT",
    );

    return getOrderById(
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

async function verifyReport(
  orderIdValue,
  authUser,
) {
  const orderId =
    positiveInteger(
      orderIdValue,
      "investigationId",
    );

  const hospitalId =
    positiveInteger(
      authUser?.hospitalId,
      "Authenticated hospital",
    );

  const verifiedBy =
    positiveInteger(
      authUser?.userId,
      "Authenticated user",
    );

  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN",
    );

    const existing =
      await client.query(
        `
          SELECT
            i.investigation_id,
            i.status

          FROM public.investigations i

          INNER JOIN public.patients p
            ON p.patient_id =
               i.patient_id

          WHERE
            i.investigation_id = $1
            AND p.hospital_id = $2
            AND i.investigation_type =
                'IMAGING'

          FOR UPDATE;
        `,
        [
          orderId,
          hospitalId,
        ],
      );

    if (!existing.rowCount) {
      throw new Error(
        "Radiology order not found.",
      );
    }

    if (
      existing.rows[0].status !==
      "RESULTED"
    ) {
      throw new Error(
        "Only a resulted radiology report can be verified.",
      );
    }

    await assertActiveUser(
      client,
      verifiedBy,
      hospitalId,
    );

    const result =
      await client.query(
        `
          UPDATE public.investigations
          SET
            status = 'VERIFIED',
            verified_by = $2,
            verified_at =
              CURRENT_TIMESTAMP

          WHERE
            investigation_id = $1

          RETURNING investigation_id;
        `,
        [
          orderId,
          verifiedBy,
        ],
      );

    await client.query(
      "COMMIT",
    );

    return getOrderById(
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
  getPatientEncounters,
  getPatientOrders,
  getOrderById,
  createOrder,
  recordReport,
  verifyReport,
};