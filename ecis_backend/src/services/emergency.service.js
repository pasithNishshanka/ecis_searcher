const pool = require("../config/database");

const EMERGENCY_STATUSES = new Set([
  "OPEN",
  "IN_TREATMENT",
  "IDENTIFICATION_PENDING",
  "IDENTIFIED",
  "DISCHARGED",
]);

const LOCATION_TYPES = new Set([
  "EMERGENCY",
  "WARD",
  "ICU",
]);

function normalizeOptionalString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();

  return normalized || null;
}

function validateEmergencyStatus(status) {
  if (!EMERGENCY_STATUSES.has(status)) {
    throw new Error(
      `Invalid emergency status: ${status}`,
    );
  }

  return status;
}

function validateLocationType(locationType) {
  if (!LOCATION_TYPES.has(locationType)) {
    throw new Error(
      `Invalid location type: ${locationType}`,
    );
  }

  return locationType;
}

/**
 * Create an emergency case.
 *
 * Important:
 *
 * - hospitalId comes from authenticated context.
 * - unidentified patients may have patient_id = NULL.
 * - identified patients must belong to the hospital.
 * - unidentified cases require a temporary reference.
 * - case_number and temporary identity are different values.
 * - identified patients receive an EMERGENCY encounter.
 * - unidentified patients intentionally do not receive a
 *   patient-linked encounter until identity is confirmed.
 */
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
    status,
  } = caseData;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (!hospitalId) {
      throw new Error("hospitalId is required");
    }

    if (!caseNumber || !caseNumber.trim()) {
      throw new Error("caseNumber is required");
    }

    if (typeof unidentifiedPatient !== "boolean") {
      throw new Error(
        "unidentifiedPatient must be boolean",
      );
    }

    const normalizedStatus =
      validateEmergencyStatus(
        status || "IN_TREATMENT",
      );

    /*
     * --------------------------------------------------------
     * Validate identified patient
     * --------------------------------------------------------
     */
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
            hospital_id
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

      if (patientResult.rowCount === 0) {
        throw new Error(
          "Active patient not found for selected hospital",
        );
      }
    }

    /*
     * --------------------------------------------------------
     * Validate unidentified patient
     * --------------------------------------------------------
     */
    if (unidentifiedPatient) {
      if (patientId) {
        throw new Error(
          "An unidentified emergency case cannot have a permanent patient_id",
        );
      }

      if (
        !temporaryIdentityReference ||
        !temporaryIdentityReference.trim()
      ) {
        throw new Error(
          "temporaryIdentityReference is required for unidentified cases",
        );
      }
    }

    /*
     * --------------------------------------------------------
     * Identity/status consistency
     * --------------------------------------------------------
     */
    if (
      !unidentifiedPatient &&
      normalizedStatus === "IDENTIFICATION_PENDING"
    ) {
      throw new Error(
        "An identified emergency case cannot have IDENTIFICATION_PENDING status",
      );
    }

    if (
      unidentifiedPatient &&
      normalizedStatus === "IDENTIFIED"
    ) {
      throw new Error(
        "An unidentified emergency case cannot have IDENTIFIED status",
      );
    }

    if (
      normalizedStatus === "DISCHARGED"
    ) {
      throw new Error(
        "A new emergency case cannot be created as DISCHARGED",
      );
    }

    /*
     * --------------------------------------------------------
     * Create encounter for identified patient
     * --------------------------------------------------------
     */
    let encounterId = null;

    if (patientId) {
      const encounterResult = await client.query(
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
            'EMERGENCY',
            COALESCE(
              $3::timestamp,
              CURRENT_TIMESTAMP
            ),
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
          normalizeOptionalString(
            chiefComplaint,
          ),
          normalizeOptionalString(
            initialCondition,
          ),
        ],
      );

      encounterId =
        encounterResult.rows[0].encounter_id;
    }

    /*
     * --------------------------------------------------------
     * Create emergency case
     * --------------------------------------------------------
     */
    const emergencyResult = await client.query(
      `
        INSERT INTO public.emergency_cases (
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
          $12,
          $13
        )
        RETURNING *;
      `,
      [
        hospitalId,
        encounterId,
        patientId || null,
        caseNumber.trim(),
        arrivalDate || null,
        normalizeOptionalString(
          arrivalMode,
        ),
        normalizeOptionalString(
          triageLevel,
        ),
        normalizeOptionalString(
          chiefComplaint,
        ),
        normalizeOptionalString(
          initialCondition,
        ),
        Boolean(unidentifiedPatient),
        unidentifiedPatient
          ? normalizeOptionalString(
              temporaryIdentityReference,
            )
          : null,
        assignedDoctorId || null,
        normalizedStatus,
      ],
    );

    await client.query("COMMIT");

    return {
      encounterId,
      emergencyCase:
        emergencyResult.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Assign an emergency case to a bed.
 *
 * This is used for:
 *
 * EMERGENCY
 * WARD
 * ICU
 *
 * It does NOT create an admission.
 *
 * This is intentional because an unidentified emergency
 * patient can occupy an emergency/critical-care location
 * before identity is confirmed.
 */
async function assignEmergencyLocation({
  emergencyCaseId,
  hospitalId,
  bedId,
  locationType,
  assignedBy,
  notes,
}) {
  const normalizedLocationType =
    validateLocationType(locationType);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /*
     * --------------------------------------------------------
     * 1. Lock emergency case
     * --------------------------------------------------------
     */
    const emergencyResult = await client.query(
      `
        SELECT
          emergency_case_id,
          hospital_id,
          patient_id,
          unidentified_patient,
          status
        FROM public.emergency_cases
        WHERE
          emergency_case_id = $1
          AND hospital_id = $2
        FOR UPDATE;
      `,
      [
        emergencyCaseId,
        hospitalId,
      ],
    );

    if (emergencyResult.rowCount === 0) {
      throw new Error(
        "Emergency case not found.",
      );
    }

    const emergencyCase =
      emergencyResult.rows[0];

    if (
      emergencyCase.status ===
      "DISCHARGED"
    ) {
      throw new Error(
        "A discharged emergency case cannot be assigned to a bed.",
      );
    }

    /*
     * --------------------------------------------------------
     * 2. Make sure no active location exists
     * --------------------------------------------------------
     */
    const activeLocationResult =
      await client.query(
        `
          SELECT
            emergency_case_location_id,
            bed_id,
            location_type
          FROM public.emergency_case_locations
          WHERE
            emergency_case_id = $1
            AND ended_at IS NULL
          FOR UPDATE;
        `,
        [emergencyCaseId],
      );

    if (
      activeLocationResult.rowCount > 0
    ) {
      throw new Error(
        "Emergency case already has an active location.",
      );
    }

    /*
     * --------------------------------------------------------
     * 3. Lock and validate target bed
     * --------------------------------------------------------
     */
    const bedResult = await client.query(
      `
        SELECT
          b.bed_id,
          b.ward_id,
          b.bed_number,
          b.bed_type,
          b.status,
          w.ward_id,
          w.hospital_id,
          w.ward_code,
          w.ward_name,
          w.ward_type,
          w.is_active
        FROM public.beds b
        INNER JOIN public.wards w
          ON w.ward_id = b.ward_id
        WHERE
          b.bed_id = $1
          AND w.hospital_id = $2
          AND w.is_active = TRUE
        FOR UPDATE;
      `,
      [
        bedId,
        hospitalId,
      ],
    );

    if (bedResult.rowCount === 0) {
      throw new Error(
        "Selected bed was not found for the authenticated hospital.",
      );
    }

    const bed = bedResult.rows[0];

    if (bed.status !== "AVAILABLE") {
      throw new Error(
        `Selected bed is not available. Current status: ${bed.status}`,
      );
    }

    /*
     * --------------------------------------------------------
     * 4. Validate location type against ward
     * --------------------------------------------------------
     */
    const wardType =
      String(
        bed.ward_type || "",
      ).trim().toUpperCase();

    if (
      normalizedLocationType ===
        "ICU" &&
      wardType !== "ICU"
    ) {
      throw new Error(
        "An ICU location must use a bed belonging to an ICU ward.",
      );
    }

    if (
      normalizedLocationType ===
        "EMERGENCY" &&
      wardType !== "EMERGENCY"
    ) {
      throw new Error(
        "An emergency location must use a bed belonging to an Emergency ward.",
      );
    }

    if (
      normalizedLocationType ===
        "WARD" &&
      (
        wardType === "ICU" ||
        wardType === "EMERGENCY"
      )
    ) {
      throw new Error(
        "A WARD location must use a normal inpatient ward bed.",
      );
    }

    /*
     * --------------------------------------------------------
     * 5. Occupy bed
     * --------------------------------------------------------
     */
    const occupiedResult =
      await client.query(
        `
          UPDATE public.beds
          SET
            status = 'OCCUPIED',
            updated_at = CURRENT_TIMESTAMP
          WHERE
            bed_id = $1
            AND status = 'AVAILABLE'
          RETURNING
            bed_id,
            bed_number,
            status;
        `,
        [bedId],
      );

    if (
      occupiedResult.rowCount === 0
    ) {
      throw new Error(
        "Unable to occupy the selected bed.",
      );
    }

    /*
     * --------------------------------------------------------
     * 6. Create location record
     * --------------------------------------------------------
     */
    const locationResult =
      await client.query(
        `
          INSERT INTO public.emergency_case_locations (
            emergency_case_id,
            bed_id,
            location_type,
            assigned_by,
            notes
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
          emergencyCaseId,
          bedId,
          normalizedLocationType,
          assignedBy,
          normalizeOptionalString(
            notes,
          ),
        ],
      );

    /*
     * --------------------------------------------------------
     * 7. Emergency status
     * --------------------------------------------------------
     */
    if (
      emergencyCase.status === "OPEN"
    ) {
      await client.query(
        `
          UPDATE public.emergency_cases
          SET
            status = 'IN_TREATMENT',
            updated_at = CURRENT_TIMESTAMP
          WHERE
            emergency_case_id = $1;
        `,
        [emergencyCaseId],
      );
    }

    await client.query("COMMIT");

    return {
      emergencyCaseId,
      location:
        locationResult.rows[0],
      bed: {
        bedId:
          occupiedResult.rows[0].bed_id,
        bedNumber:
          occupiedResult.rows[0].bed_number,
        status:
          occupiedResult.rows[0].status,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Move an emergency case from one location to another.
 *
 * Example:
 *
 * Emergency bed
 *     ↓
 * ICU bed
 *
 * or:
 *
 * Emergency bed
 *     ↓
 * Ward bed
 */
async function transferEmergencyLocation({
  emergencyCaseId,
  hospitalId,
  targetBedId,
  targetLocationType,
  assignedBy,
  notes,
}) {
  const normalizedLocationType =
    validateLocationType(
      targetLocationType,
    );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /*
     * --------------------------------------------------------
     * 1. Lock emergency case
     * --------------------------------------------------------
     */
    const emergencyResult = await client.query(
      `
        SELECT
          emergency_case_id,
          hospital_id,
          patient_id,
          unidentified_patient,
          status
        FROM public.emergency_cases
        WHERE
          emergency_case_id = $1
          AND hospital_id = $2
        FOR UPDATE;
      `,
      [
        emergencyCaseId,
        hospitalId,
      ],
    );

    if (emergencyResult.rowCount === 0) {
      throw new Error(
        "Emergency case not found.",
      );
    }

    const emergencyCase =
      emergencyResult.rows[0];

    if (
      emergencyCase.status ===
      "DISCHARGED"
    ) {
      throw new Error(
        "A discharged emergency case cannot be transferred.",
      );
    }

    /*
     * --------------------------------------------------------
     * 2. Lock current location
     * --------------------------------------------------------
     */
    const currentLocationResult =
      await client.query(
        `
          SELECT
            emergency_case_location_id,
            bed_id,
            location_type
          FROM public.emergency_case_locations
          WHERE
            emergency_case_id = $1
            AND ended_at IS NULL
          FOR UPDATE;
        `,
        [emergencyCaseId],
      );

    if (
      currentLocationResult.rowCount === 0
    ) {
      throw new Error(
        "Emergency case does not currently have an active location.",
      );
    }

    const currentLocation =
      currentLocationResult.rows[0];

    if (
      Number(currentLocation.bed_id) ===
      Number(targetBedId)
    ) {
      throw new Error(
        "The target bed is already the current bed.",
      );
    }

    /*
     * --------------------------------------------------------
     * 3. Lock target bed
     * --------------------------------------------------------
     */
    const targetBedResult =
      await client.query(
        `
          SELECT
            b.bed_id,
            b.ward_id,
            b.bed_number,
            b.bed_type,
            b.status,
            w.hospital_id,
            w.ward_code,
            w.ward_name,
            w.ward_type,
            w.is_active
          FROM public.beds b
          INNER JOIN public.wards w
            ON w.ward_id = b.ward_id
          WHERE
            b.bed_id = $1
            AND w.hospital_id = $2
            AND w.is_active = TRUE
          FOR UPDATE;
        `,
        [
          targetBedId,
          hospitalId,
        ],
      );

    if (
      targetBedResult.rowCount === 0
    ) {
      throw new Error(
        "Target bed was not found for the authenticated hospital.",
      );
    }

    const targetBed =
      targetBedResult.rows[0];

    if (
      targetBed.status !==
      "AVAILABLE"
    ) {
      throw new Error(
        `Target bed is not available. Current status: ${targetBed.status}`,
      );
    }

    /*
     * --------------------------------------------------------
     * 4. Validate target ward type
     * --------------------------------------------------------
     */
    const targetWardType =
      String(
        targetBed.ward_type || "",
      )
        .trim()
        .toUpperCase();

    if (
      normalizedLocationType ===
        "ICU" &&
      targetWardType !== "ICU"
    ) {
      throw new Error(
        "An ICU location must use a bed belonging to an ICU ward.",
      );
    }

    if (
      normalizedLocationType ===
        "EMERGENCY" &&
      targetWardType !== "EMERGENCY"
    ) {
      throw new Error(
        "An emergency location must use a bed belonging to an Emergency ward.",
      );
    }

    if (
      normalizedLocationType ===
        "WARD" &&
      (
        targetWardType === "ICU" ||
        targetWardType === "EMERGENCY"
      )
    ) {
      throw new Error(
        "A WARD location must use a normal inpatient ward bed.",
      );
    }

    /*
     * --------------------------------------------------------
     * 5. End current location
     * --------------------------------------------------------
     */
    await client.query(
      `
        UPDATE public.emergency_case_locations
        SET
          ended_at = CURRENT_TIMESTAMP
        WHERE
          emergency_case_location_id = $1
          AND ended_at IS NULL;
      `,
      [
        currentLocation.emergency_case_location_id,
      ],
    );

    /*
     * --------------------------------------------------------
     * 6. Release old bed
     * --------------------------------------------------------
     */
    const releasedResult =
      await client.query(
        `
          UPDATE public.beds
          SET
            status = 'AVAILABLE',
            updated_at = CURRENT_TIMESTAMP
          WHERE
            bed_id = $1
            AND status = 'OCCUPIED'
          RETURNING bed_id;
        `,
        [currentLocation.bed_id],
      );

    if (
      releasedResult.rowCount === 0
    ) {
      throw new Error(
        "Unable to release the current emergency bed.",
      );
    }

    /*
     * --------------------------------------------------------
     * 7. Occupy target bed
     * --------------------------------------------------------
     */
    const occupiedResult =
      await client.query(
        `
          UPDATE public.beds
          SET
            status = 'OCCUPIED',
            updated_at = CURRENT_TIMESTAMP
          WHERE
            bed_id = $1
            AND status = 'AVAILABLE'
          RETURNING
            bed_id,
            bed_number,
            status;
        `,
        [targetBedId],
      );

    if (
      occupiedResult.rowCount === 0
    ) {
      throw new Error(
        "Unable to occupy the target bed.",
      );
    }

    /*
     * --------------------------------------------------------
     * 8. Create new location
     * --------------------------------------------------------
     */
    const locationResult =
      await client.query(
        `
          INSERT INTO public.emergency_case_locations (
            emergency_case_id,
            bed_id,
            location_type,
            assigned_by,
            notes
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
          emergencyCaseId,
          targetBedId,
          normalizedLocationType,
          assignedBy,
          normalizeOptionalString(
            notes,
          ),
        ],
      );

    await client.query("COMMIT");

    return {
      emergencyCaseId,
      previousLocation:
        currentLocation,
      location:
        locationResult.rows[0],
      bed: {
        bedId:
          occupiedResult.rows[0].bed_id,
        bedNumber:
          occupiedResult.rows[0].bed_number,
        status:
          occupiedResult.rows[0].status,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Discharge an emergency case from its current location.
 *
 * This:
 *
 * 1. Locks the emergency case.
 * 2. Finds the active location.
 * 3. Ends the location.
 * 4. Releases the occupied bed.
 * 5. Marks the emergency case DISCHARGED.
 */
async function dischargeEmergencyCase({
  emergencyCaseId,
  hospitalId,
  dischargedBy,
  notes,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const emergencyResult = await client.query(
      `
        SELECT
          emergency_case_id,
          hospital_id,
          status
        FROM public.emergency_cases
        WHERE
          emergency_case_id = $1
          AND hospital_id = $2
        FOR UPDATE;
      `,
      [
        emergencyCaseId,
        hospitalId,
      ],
    );

    if (emergencyResult.rowCount === 0) {
      throw new Error(
        "Emergency case not found.",
      );
    }

    const emergencyCase =
      emergencyResult.rows[0];

    if (
      emergencyCase.status ===
      "DISCHARGED"
    ) {
      throw new Error(
        "Emergency case is already discharged.",
      );
    }

    const locationResult =
      await client.query(
        `
          SELECT
            emergency_case_location_id,
            bed_id,
            location_type
          FROM public.emergency_case_locations
          WHERE
            emergency_case_id = $1
            AND ended_at IS NULL
          FOR UPDATE;
        `,
        [emergencyCaseId],
      );

    if (
      locationResult.rowCount > 0
    ) {
      const activeLocation =
        locationResult.rows[0];

      await client.query(
        `
          UPDATE public.emergency_case_locations
          SET
            ended_at = CURRENT_TIMESTAMP,
            notes = CASE
              WHEN $2::text IS NULL
                THEN notes
              WHEN notes IS NULL
                THEN $2::text
              ELSE notes || E'\\n' || $2::text
            END
          WHERE
            emergency_case_location_id = $1
            AND ended_at IS NULL;
        `,
        [
          activeLocation.emergency_case_location_id,
          normalizeOptionalString(
            notes,
          ),
        ],
      );

      const releasedResult =
        await client.query(
          `
            UPDATE public.beds
            SET
              status = 'AVAILABLE',
              updated_at = CURRENT_TIMESTAMP
            WHERE
              bed_id = $1
              AND status = 'OCCUPIED'
            RETURNING bed_id;
          `,
          [activeLocation.bed_id],
        );

      if (
        releasedResult.rowCount === 0
      ) {
        throw new Error(
          "Unable to release the occupied emergency bed.",
        );
      }
    }

    const updatedResult =
      await client.query(
        `
          UPDATE public.emergency_cases
          SET
            status = 'DISCHARGED',
            updated_at = CURRENT_TIMESTAMP
          WHERE
            emergency_case_id = $1
          RETURNING *;
        `,
        [emergencyCaseId],
      );

    if (
      updatedResult.rowCount === 0
    ) {
      throw new Error(
        "Unable to discharge emergency case.",
      );
    }

    await client.query("COMMIT");

    return {
      emergencyCase:
        updatedResult.rows[0],
      dischargedBy,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get the current location of an emergency case.
 */
async function getEmergencyCaseLocation(
  emergencyCaseId,
  hospitalId,
) {
  const result = await pool.query(
    `
      SELECT
        ecl.emergency_case_location_id,
        ecl.emergency_case_id,
        ecl.bed_id,
        ecl.location_type,
        ecl.started_at,
        ecl.ended_at,
        ecl.assigned_by,
        ecl.notes,

        b.bed_number,
        b.bed_type,
        b.status AS bed_status,

        w.ward_id,
        w.ward_code,
        w.ward_name,
        w.ward_type,
        w.floor,
        w.location,

        u.full_name AS assigned_by_name

      FROM public.emergency_case_locations ecl

      INNER JOIN public.emergency_cases ec
        ON ec.emergency_case_id =
          ecl.emergency_case_id

      INNER JOIN public.beds b
        ON b.bed_id = ecl.bed_id

      INNER JOIN public.wards w
        ON w.ward_id = b.ward_id

      LEFT JOIN public.hospital_users u
        ON u.user_id = ecl.assigned_by

      WHERE
        ecl.emergency_case_id = $1
        AND ec.hospital_id = $2
        AND ecl.ended_at IS NULL

      LIMIT 1;
    `,
    [
      emergencyCaseId,
      hospitalId,
    ],
  );

  return result.rows[0] || null;
}

/**
 * Get all location history for an emergency case.
 */
async function getEmergencyCaseLocationHistory(
  emergencyCaseId,
  hospitalId,
) {
  const result = await pool.query(
    `
      SELECT
        ecl.emergency_case_location_id,
        ecl.emergency_case_id,
        ecl.bed_id,
        ecl.location_type,
        ecl.started_at,
        ecl.ended_at,
        ecl.assigned_by,
        ecl.notes,

        b.bed_number,
        b.bed_type,

        w.ward_id,
        w.ward_code,
        w.ward_name,
        w.ward_type,

        u.full_name AS assigned_by_name

      FROM public.emergency_case_locations ecl

      INNER JOIN public.emergency_cases ec
        ON ec.emergency_case_id =
          ecl.emergency_case_id

      INNER JOIN public.beds b
        ON b.bed_id = ecl.bed_id

      INNER JOIN public.wards w
        ON w.ward_id = b.ward_id

      LEFT JOIN public.hospital_users u
        ON u.user_id = ecl.assigned_by

      WHERE
        ecl.emergency_case_id = $1
        AND ec.hospital_id = $2

      ORDER BY
        ecl.started_at ASC;
    `,
    [
      emergencyCaseId,
      hospitalId,
    ],
  );

  return result.rows;
}

async function getEmergencyCases(
  hospitalId,
) {
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
      e.encounter_id,
      e.identified_at,
      e.identified_by,

      p.patient_id,
      p.patient_number,

      CONCAT(
        p.first_name,
        CASE
          WHEN p.last_name IS NOT NULL
            AND TRIM(p.last_name) <> ''
          THEN ' ' || p.last_name
          ELSE ''
        END
      ) AS patient_name,

      h.hospital_id,
      h.hospital_name,

      u.user_id AS assigned_doctor_id,
      u.full_name AS assigned_doctor_name

    FROM public.emergency_cases e

    INNER JOIN public.hospitals h
      ON e.hospital_id = h.hospital_id

    LEFT JOIN public.patients p
      ON e.patient_id = p.patient_id

    LEFT JOIN public.hospital_users u
      ON e.assigned_doctor_id = u.user_id

    WHERE
      e.hospital_id = $1

    ORDER BY
      e.arrival_date DESC;
  `;

  const result = await pool.query(
    query,
    [hospitalId],
  );

  return result.rows;
}

async function getEmergencyCaseById(
  emergencyCaseId,
  hospitalId,
) {
  const query = `
    SELECT
      e.*,

      p.patient_number,
      p.first_name,
      p.middle_name,
      p.last_name,

      h.hospital_name,

      u.full_name AS assigned_doctor_name

    FROM public.emergency_cases e

    INNER JOIN public.hospitals h
      ON e.hospital_id = h.hospital_id

    LEFT JOIN public.patients p
      ON e.patient_id = p.patient_id

    LEFT JOIN public.hospital_users u
      ON e.assigned_doctor_id = u.user_id

    WHERE
      e.emergency_case_id = $1
      AND e.hospital_id = $2;
  `;

  const result = await pool.query(
    query,
    [
      emergencyCaseId,
      hospitalId,
    ],
  );

  return result.rows[0] || null;
}

module.exports = {
  createEmergencyCase,
  getEmergencyCases,
  getEmergencyCaseById,
  assignEmergencyLocation,
  transferEmergencyLocation,
  dischargeEmergencyCase,
  getEmergencyCaseLocation,
  getEmergencyCaseLocationHistory,
};