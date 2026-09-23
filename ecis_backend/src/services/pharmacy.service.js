const pool =
  require("../config/database");


/* ============================================================
   HELPERS
   ============================================================ */

function toPositiveInteger(
  value,
  fieldName,
) {
  const number =
    Number(value);

  if (
    !Number.isInteger(number) ||
    number <= 0
  ) {
    throw new Error(
      `${fieldName} must be a valid positive integer.`,
    );
  }

  return number;
}


function nullablePositiveInteger(
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

  return toPositiveInteger(
    value,
    fieldName,
  );
}


function nullableNumber(
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

  const number =
    Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    throw new Error(
      `${fieldName} must be a positive number.`,
    );
  }

  return number;
}


function nullableString(
  value,
) {
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


/* ============================================================
   CREATE MEDICATION ORDER
   ============================================================ */

async function createMedicationOrder(
  medicationData,
  authUser,
) {
  const patientId =
    toPositiveInteger(
      medicationData.patientId,
      "patientId",
    );

  const encounterId =
    toPositiveInteger(
      medicationData.encounterId,
      "encounterId",
    );

  const admissionId =
    nullablePositiveInteger(
      medicationData.admissionId,
      "admissionId",
    );

  const hospitalId =
    toPositiveInteger(
      authUser?.hospitalId,
      "Authenticated hospital",
    );

  const prescribedByUserId =
    toPositiveInteger(
      authUser?.userId,
      "Authenticated user",
    );

  const medicationName =
    String(
      medicationData.medicationName ||
        "",
    ).trim();

  const dosage =
    String(
      medicationData.dosage ||
        "",
    ).trim();

  const frequency =
    String(
      medicationData.frequency ||
        "",
    ).trim();

  if (!medicationName) {
    throw new Error(
      "medicationName is required.",
    );
  }

  if (!dosage) {
    throw new Error(
      "dosage is required.",
    );
  }

  if (!frequency) {
    throw new Error(
      "frequency is required.",
    );
  }


  const strength =
    nullableString(
      medicationData.strength,
    );

  const route =
    nullableString(
      medicationData.route,
    );

  const durationValue =
    nullableNumber(
      medicationData.durationValue,
      "durationValue",
    );

  const durationUnit =
    nullableString(
      medicationData.durationUnit,
    );

  const quantityPrescribed =
    nullableNumber(
      medicationData.quantityPrescribed,
      "quantityPrescribed",
    );

  const quantityUnit =
    nullableString(
      medicationData.quantityUnit,
    );

  const instructions =
    nullableString(
      medicationData.instructions,
    );

  const indication =
    nullableString(
      medicationData.indication,
    );

  const prescribedNotes =
    nullableString(
      medicationData.prescribedNotes,
    );


  let startDate =
    medicationData.startDate ||
    null;

  let endDate =
    medicationData.endDate ||
    null;


  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN",
    );


    /* --------------------------------------------------------
       PATIENT
       -------------------------------------------------------- */

    const patientResult =
      await client.query(
        `
        SELECT
          patient_id,
          patient_number,
          first_name,
          middle_name,
          last_name,
          date_of_birth,
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


    if (!patientResult.rowCount) {
      throw new Error(
        "Patient not found in the authenticated hospital.",
      );
    }


    const patient =
      patientResult.rows[0];


    if (
      patient.status &&
      patient.status !==
        "ACTIVE"
    ) {
      throw new Error(
        "Medication orders can only be created for an active patient.",
      );
    }


    /* --------------------------------------------------------
       ADULT PATIENT RULE
       -------------------------------------------------------- */

    if (
      !patient.date_of_birth
    ) {
      throw new Error(
        "Patient date of birth is required for the adult medication workflow.",
      );
    }


    const dob =
      new Date(
        patient.date_of_birth,
      );

    const today =
      new Date();

    let age =
      today.getFullYear() -
      dob.getFullYear();

    const monthDifference =
      today.getMonth() -
      dob.getMonth();

    if (
      monthDifference < 0 ||
      (
        monthDifference === 0 &&
        today.getDate() <
          dob.getDate()
      )
    ) {
      age -= 1;
    }


    if (age < 18) {
      throw new Error(
        "The medication workflow is restricted to adult patients aged 18 or older.",
      );
    }


    /* --------------------------------------------------------
       ENCOUNTER
       -------------------------------------------------------- */

    const encounterResult =
      await client.query(
        `
        SELECT
          encounter_id,
          patient_id,
          hospital_id
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


    if (!encounterResult.rowCount) {
      throw new Error(
        "Encounter does not belong to the selected patient and hospital.",
      );
    }


    /* --------------------------------------------------------
       ADMISSION
       -------------------------------------------------------- */

    if (admissionId) {
      const admissionResult =
        await client.query(
          `
          SELECT
            admission_id,
            patient_id,
            encounter_id,
            status
          FROM public.admissions
          WHERE
            admission_id = $1
            AND patient_id = $2
            AND encounter_id = $3
          FOR SHARE;
          `,
          [
            admissionId,
            patientId,
            encounterId,
          ],
        );


      if (!admissionResult.rowCount) {
        throw new Error(
          "Admission does not belong to the selected patient and encounter.",
        );
      }
    }


    /* --------------------------------------------------------
       DATE VALIDATION
       -------------------------------------------------------- */

    if (
      startDate
    ) {
      const start =
        new Date(
          startDate,
        );

      if (
        Number.isNaN(
          start.getTime(),
        )
      ) {
        throw new Error(
          "startDate is invalid.",
        );
      }
    }


    if (
      endDate
    ) {
      const end =
        new Date(
          endDate,
        );

      if (
        Number.isNaN(
          end.getTime(),
        )
      ) {
        throw new Error(
          "endDate is invalid.",
        );
      }
    }


    if (
      startDate &&
      endDate &&
      new Date(endDate) <
        new Date(startDate)
    ) {
      throw new Error(
        "endDate cannot be earlier than startDate.",
      );
    }


    /* --------------------------------------------------------
       INSERT
       -------------------------------------------------------- */

    const result =
      await client.query(
        `
        INSERT INTO public.medication_orders (
          hospital_id,
          patient_id,
          encounter_id,
          admission_id,
          prescribed_by_user_id,
          medication_name,
          strength,
          dosage,
          route,
          frequency,
          duration_value,
          duration_unit,
          quantity_prescribed,
          quantity_unit,
          instructions,
          indication,
          start_date,
          end_date,
          order_status,
          prescribed_notes
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
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
          COALESCE(
            $17::timestamp,
            CURRENT_TIMESTAMP
          ),
          $18::timestamp,
          'ORDERED',
          $19
        )
        RETURNING
          medication_order_id;
        `,
        [
          hospitalId,
          patientId,
          encounterId,
          admissionId,
          prescribedByUserId,
          medicationName,
          strength,
          dosage,
          route,
          frequency,
          durationValue,
          durationUnit,
          quantityPrescribed,
          quantityUnit,
          instructions,
          indication,
          startDate,
          endDate,
          prescribedNotes,
        ],
      );


    await client.query(
      "COMMIT",
    );


    return getMedicationOrderById(
      result.rows[0]
        .medication_order_id,
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


/* ============================================================
   GET PATIENT MEDICATION HISTORY
   ============================================================ */

async function getPatientMedicationOrders(
  patientId,
  hospitalId,
) {
  const normalizedPatientId =
    toPositiveInteger(
      patientId,
      "patientId",
    );

  const normalizedHospitalId =
    toPositiveInteger(
      hospitalId,
      "hospitalId",
    );


  const result =
    await pool.query(
      `
      SELECT
        *
      FROM public.vw_medication_longitudinal_history
      WHERE
        patient_id = $1
        AND hospital_id = $2
      ORDER BY
        start_date DESC,
        medication_order_id DESC;
      `,
      [
        normalizedPatientId,
        normalizedHospitalId,
      ],
    );


  return result.rows;
}


/* ============================================================
   GET ONE MEDICATION ORDER
   ============================================================ */

async function getMedicationOrderById(
  medicationOrderId,
  hospitalId,
) {
  const normalizedOrderId =
    toPositiveInteger(
      medicationOrderId,
      "medicationOrderId",
    );

  const normalizedHospitalId =
    toPositiveInteger(
      hospitalId,
      "hospitalId",
    );


  const result =
    await pool.query(
      `
      SELECT
        *
      FROM public.vw_medication_longitudinal_history
      WHERE
        medication_order_id = $1
        AND hospital_id = $2
      LIMIT 1;
      `,
      [
        normalizedOrderId,
        normalizedHospitalId,
      ],
    );


  return (
    result.rows[0] ||
    null
  );
}


/* ============================================================
   GET ALL MEDICATION ORDERS
   ============================================================ */

async function getAllMedicationOrders(
  hospitalId,
) {
  const normalizedHospitalId =
    toPositiveInteger(
      hospitalId,
      "hospitalId",
    );


  const result =
    await pool.query(
      `
      SELECT
        *
      FROM public.vw_medication_longitudinal_history
      WHERE
        hospital_id = $1
      ORDER BY
        start_date DESC,
        medication_order_id DESC;
      `,
      [
        normalizedHospitalId,
      ],
    );


  return result.rows;
}


/* ============================================================
   DISPENSE MEDICATION
   ============================================================ */

async function dispenseMedication(
  medicationOrderId,
  dispensingData,
  authUser,
) {
  const orderId =
    toPositiveInteger(
      medicationOrderId,
      "medicationOrderId",
    );

  const hospitalId =
    toPositiveInteger(
      authUser?.hospitalId,
      "Authenticated hospital",
    );

  const dispensedByUserId =
    toPositiveInteger(
      authUser?.userId,
      "Authenticated user",
    );

  const dispensedQuantity =
    Number(
      dispensingData.dispensedQuantity,
    );

  if (
    !Number.isFinite(
      dispensedQuantity,
    ) ||
    dispensedQuantity <= 0
  ) {
    throw new Error(
      "dispensedQuantity must be greater than zero.",
    );
  }


  const quantityUnit =
    String(
      dispensingData.quantityUnit ||
        "",
    ).trim();


  if (!quantityUnit) {
    throw new Error(
      "quantityUnit is required.",
    );
  }


  const pharmacyNotes =
    nullableString(
      dispensingData.pharmacyNotes,
    );


  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN",
    );


    /* --------------------------------------------------------
       LOCK ORDER
       -------------------------------------------------------- */

    const orderResult =
      await client.query(
        `
        SELECT
          medication_order_id,
          hospital_id,
          patient_id,
          quantity_prescribed,
          quantity_unit,
          order_status
        FROM public.medication_orders
        WHERE
          medication_order_id = $1
          AND hospital_id = $2
        FOR UPDATE;
        `,
        [
          orderId,
          hospitalId,
        ],
      );


    if (!orderResult.rowCount) {
      throw new Error(
        "Medication order not found in the authenticated hospital.",
      );
    }


    const order =
      orderResult.rows[0];


    if (
      order.order_status ===
        "CANCELLED" ||
      order.order_status ===
        "DISCONTINUED" ||
      order.order_status ===
        "COMPLETED"
    ) {
      throw new Error(
        `Medication order cannot be dispensed while it is ${order.order_status}.`,
      );
    }


    /* --------------------------------------------------------
       DISPENSED QUANTITY CHECK
       -------------------------------------------------------- */

    if (
      order.quantity_prescribed !==
      null
    ) {
      const existingResult =
        await client.query(
          `
          SELECT
            COALESCE(
              SUM(
                dispensed_quantity
              ),
              0
            ) AS total_dispensed
          FROM public.medication_dispensations
          WHERE
            medication_order_id = $1
            AND dispensing_status =
              'DISPENSED';
          `,
          [
            orderId,
          ],
        );


      const totalDispensed =
        Number(
          existingResult.rows[0]
            .total_dispensed ||
            0,
        );

      const prescribed =
        Number(
          order.quantity_prescribed,
        );

      const newTotal =
        totalDispensed +
        dispensedQuantity;


      if (
        newTotal >
        prescribed
      ) {
        throw new Error(
          `Dispensed quantity exceeds the prescribed quantity. Remaining quantity: ${
            prescribed -
            totalDispensed
          }.`,
        );
      }
    }


    /* --------------------------------------------------------
       UNIT CONSISTENCY
       -------------------------------------------------------- */

    if (
      order.quantity_unit &&
      String(
        order.quantity_unit,
      ).trim().toLowerCase() !==
        quantityUnit.toLowerCase()
    ) {
      throw new Error(
        "Dispensing quantity unit does not match the prescribed quantity unit.",
      );
    }


    /* --------------------------------------------------------
       INSERT DISPENSATION
       -------------------------------------------------------- */

    const result =
      await client.query(
        `
        INSERT INTO public.medication_dispensations (
          medication_order_id,
          hospital_id,
          dispensed_by_user_id,
          dispensed_quantity,
          quantity_unit,
          dispensed_at,
          dispensing_status,
          pharmacy_notes
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
          'DISPENSED',
          $7
        )
        RETURNING *;
        `,
        [
          orderId,
          hospitalId,
          dispensedByUserId,
          dispensedQuantity,
          quantityUnit,
          dispensingData.dispensedAt ||
            null,
          pharmacyNotes,
        ],
      );


    await client.query(
      "COMMIT",
    );


    return result.rows[0];
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
   GET DISPENSATION HISTORY
   ============================================================ */

async function getMedicationDispensations(
  medicationOrderId,
  hospitalId,
) {
  const normalizedOrderId =
    toPositiveInteger(
      medicationOrderId,
      "medicationOrderId",
    );

  const normalizedHospitalId =
    toPositiveInteger(
      hospitalId,
      "hospitalId",
    );


  const result =
    await pool.query(
      `
      SELECT
        md.medication_dispensation_id,
        md.medication_order_id,
        md.hospital_id,
        md.dispensed_by_user_id,
        u.full_name
          AS dispensed_by_name,
        md.dispensed_quantity,
        md.quantity_unit,
        md.dispensed_at,
        md.dispensing_status,
        md.pharmacy_notes,
        md.created_at
      FROM public.medication_dispensations md
      LEFT JOIN public.hospital_users u
        ON u.user_id =
           md.dispensed_by_user_id
      WHERE
        md.medication_order_id = $1
        AND md.hospital_id = $2
      ORDER BY
        md.dispensed_at DESC,
        md.medication_dispensation_id DESC;
      `,
      [
        normalizedOrderId,
        normalizedHospitalId,
      ],
    );


  return result.rows;
}


/* ============================================================
   CANCEL MEDICATION ORDER
   ============================================================ */

async function cancelMedicationOrder(
  medicationOrderId,
  cancellationData,
  authUser,
) {
  const orderId =
    toPositiveInteger(
      medicationOrderId,
      "medicationOrderId",
    );

  const hospitalId =
    toPositiveInteger(
      authUser?.hospitalId,
      "Authenticated hospital",
    );

  const reason =
    String(
      cancellationData.reason ||
        "",
    ).trim();


  if (!reason) {
    throw new Error(
      "Cancellation reason is required.",
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
          medication_order_id,
          order_status
        FROM public.medication_orders
        WHERE
          medication_order_id = $1
          AND hospital_id = $2
        FOR UPDATE;
        `,
        [
          orderId,
          hospitalId,
        ],
      );


    if (!orderResult.rowCount) {
      throw new Error(
        "Medication order not found.",
      );
    }


    const order =
      orderResult.rows[0];


    if (
      order.order_status ===
        "CANCELLED"
    ) {
      throw new Error(
        "Medication order is already cancelled.",
      );
    }


    if (
      order.order_status ===
        "DISPENSED" ||
      order.order_status ===
        "COMPLETED"
    ) {
      throw new Error(
        "A dispensed or completed medication order cannot be cancelled.",
      );
    }


    await client.query(
      `
      UPDATE public.medication_orders
      SET
        order_status = 'CANCELLED',
        cancelled_reason = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE
        medication_order_id = $2
        AND hospital_id = $3;
      `,
      [
        reason,
        orderId,
        hospitalId,
      ],
    );


    await client.query(
      "COMMIT",
    );


    return getMedicationOrderById(
      orderId,
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


/* ============================================================
   EXPORTS
   ============================================================ */

module.exports = {
  createMedicationOrder,
  getAllMedicationOrders,
  getPatientMedicationOrders,
  getMedicationOrderById,
  dispenseMedication,
  getMedicationDispensations,
  cancelMedicationOrder,
};