const pool = require("../config/database");

/**
 * Create a normal inpatient admission.
 *
 * Everything happens inside one transaction:
 *
 * 1. Verify patient.
 * 2. Verify ward.
 * 3. Lock bed.
 * 4. Verify bed availability.
 * 5. Verify patient has no active admission.
 * 6. Create encounter.
 * 7. Create admission.
 * 8. Mark bed as occupied.
 */
async function createAdmission(admissionData) {
  const {
    patientId,
    hospitalId,
    wardId,
    bedId,
    admissionNumber,
    admissionDate,
    admissionReason,
    admissionDiagnosis,
    attendingDoctorId,
  } = admissionData;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const patientResult = await client.query(
      `
        SELECT
          patient_id,
          hospital_id,
          patient_number,
          first_name,
          last_name
        FROM public.patients
        WHERE
          patient_id = $1
          AND hospital_id = $2
          AND status = 'ACTIVE'
        FOR SHARE;
      `,
      [patientId, hospitalId],
    );

    if (patientResult.rowCount === 0) {
      throw new Error("Active patient not found for the selected hospital");
    }

    const wardResult = await client.query(
      `
        SELECT
          ward_id,
          hospital_id,
          ward_name,
          ward_type,
          capacity,
          is_active
        FROM public.wards
        WHERE
          ward_id = $1
          AND hospital_id = $2
          AND is_active = TRUE
        FOR SHARE;
      `,
      [wardId, hospitalId],
    );

    if (wardResult.rowCount === 0) {
      throw new Error("Active ward not found for the selected hospital");
    }

    const bedResult = await client.query(
      `
        SELECT
          b.bed_id,
          b.ward_id,
          b.bed_number,
          b.bed_type,
          b.status
        FROM public.beds b
        INNER JOIN public.wards w
          ON w.ward_id = b.ward_id
        WHERE
          b.bed_id = $1
          AND b.ward_id = $2
          AND w.hospital_id = $3
          AND w.is_active = TRUE
        FOR UPDATE;
      `,
      [bedId, wardId, hospitalId],
    );

    if (bedResult.rowCount === 0) {
      throw new Error("Selected bed does not belong to the selected ward");
    }

    const bed = bedResult.rows[0];

    if (bed.status !== "AVAILABLE") {
      throw new Error(
        `Selected bed is not available. Current status: ${bed.status}`,
      );
    }

    const activeAdmissionResult = await client.query(
      `
          SELECT
            admission_id,
            admission_number,
            ward_id,
            bed_id
          FROM public.admissions
          WHERE
            patient_id = $1
            AND status = 'ADMITTED'
          LIMIT 1
          FOR SHARE;
        `,
      [patientId],
    );

    if (activeAdmissionResult.rowCount > 0) {
      throw new Error("Patient already has an active admission");
    }

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
            'WARD',
            COALESCE(
              $3::timestamp,
              CURRENT_TIMESTAMP
            ),
            'Ward',
            'OPEN',
            $4,
            $5
          )
          RETURNING encounter_id;
        `,
      [
        patientId,
        hospitalId,
        admissionDate || null,
        admissionReason || null,
        admissionDiagnosis || null,
      ],
    );

    const encounterId = encounterResult.rows[0].encounter_id;

    const admissionResult = await client.query(
      `
          INSERT INTO public.admissions (
            patient_id,
            encounter_id,
            ward_id,
            bed_id,
            admission_number,
            admission_date,
            admission_reason,
            admission_diagnosis,
            attending_doctor_id,
            status
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
            'ADMITTED'
          )
          RETURNING *;
        `,
      [
        patientId,
        encounterId,
        wardId,
        bedId,
        admissionNumber,
        admissionDate || null,
        admissionReason || null,
        admissionDiagnosis || null,
        attendingDoctorId || null,
      ],
    );

    const admission = admissionResult.rows[0];

    const occupiedResult = await client.query(
      `
          UPDATE public.beds
          SET
            status = 'OCCUPIED',
            updated_at = CURRENT_TIMESTAMP
          WHERE
            bed_id = $1
            AND ward_id = $2
            AND status = 'AVAILABLE'
          RETURNING
            bed_id,
            bed_number,
            status;
        `,
      [bedId, wardId],
    );

    if (occupiedResult.rowCount === 0) {
      throw new Error("Unable to mark the selected bed as occupied.");
    }

    await client.query("COMMIT");

    return {
      encounterId,
      admission,
      bed: {
        bedId: occupiedResult.rows[0].bed_id,
        bedNumber: occupiedResult.rows[0].bed_number,
        status: occupiedResult.rows[0].status,
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
 * Admit an identified emergency patient into a Ward or ICU.
 *
 * This operation is deliberately transactional.
 *
 * Example:
 *
 * Emergency bed
 *      ↓
 * ICU bed
 *
 * OR
 *
 * Emergency bed
 *      ↓
 * Ward bed
 *
 * The operation:
 *
 * 1. Locks the emergency case.
 * 2. Requires the case to be identified.
 * 3. Verifies the patient.
 * 4. Verifies no active admission exists.
 * 5. Locks the target bed.
 * 6. Creates/reuses the inpatient encounter.
 * 7. Creates the admission.
 * 8. Occupies the target bed.
 * 9. Ends the previous emergency location.
 * 10. Releases the previous emergency bed.
 * 11. Records the new Ward/ICU location.
 */
async function createEmergencyAdmission(admissionData) {
  const {
    emergencyCaseId,
    hospitalId,
    wardId,
    bedId,
    admissionNumber,
    admissionDate,
    admissionReason,
    admissionDiagnosis,
    attendingDoctorId,
  } = admissionData;

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
            encounter_id,
            patient_id,
            case_number,
            unidentified_patient,
            status,
            chief_complaint,
            initial_condition
          FROM public.emergency_cases
          WHERE
            emergency_case_id = $1
            AND hospital_id = $2
          FOR UPDATE;
        `,
      [emergencyCaseId, hospitalId],
    );

    if (emergencyResult.rowCount === 0) {
      throw new Error("Emergency case not found for the selected hospital");
    }

    const emergencyCase = emergencyResult.rows[0];

    /*
     * --------------------------------------------------------
     * 2. Patient must already be identified
     * --------------------------------------------------------
     */
    if (emergencyCase.unidentified_patient || !emergencyCase.patient_id) {
      throw new Error("Emergency case must be identified before admission");
    }

    if (emergencyCase.status === "DISCHARGED") {
      throw new Error("A discharged emergency case cannot be admitted");
    }

    /*
     * --------------------------------------------------------
     * 3. Verify patient
     * --------------------------------------------------------
     */
    const patientResult = await client.query(
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
      [emergencyCase.patient_id, hospitalId],
    );

    if (patientResult.rowCount === 0) {
      throw new Error(
        "Identified patient was not found for the selected hospital",
      );
    }

    const patient = patientResult.rows[0];

    /*
     * --------------------------------------------------------
     * 4. Patient cannot already be admitted
     * --------------------------------------------------------
     */
    const activeAdmissionResult = await client.query(
      `
          SELECT
            admission_id,
            admission_number,
            ward_id,
            bed_id
          FROM public.admissions
          WHERE
            patient_id = $1
            AND status = 'ADMITTED'
          LIMIT 1
          FOR SHARE;
        `,
      [patient.patient_id],
    );

    if (activeAdmissionResult.rowCount > 0) {
      throw new Error("Patient already has an active admission");
    }

    /*
     * --------------------------------------------------------
     * 5. Verify target ward
     * --------------------------------------------------------
     */
    const wardResult = await client.query(
      `
          SELECT
            ward_id,
            hospital_id,
            ward_code,
            ward_name,
            ward_type,
            capacity,
            is_active
          FROM public.wards
          WHERE
            ward_id = $1
            AND hospital_id = $2
            AND is_active = TRUE
          FOR SHARE;
        `,
      [wardId, hospitalId],
    );

    if (wardResult.rowCount === 0) {
      throw new Error("Active ward not found for the selected hospital");
    }

    const ward = wardResult.rows[0];

    const wardType = String(ward.ward_type || "")
      .trim()
      .toUpperCase();

    /*
     * Emergency beds are not inpatient admission beds.
     */
    if (wardType === "EMERGENCY") {
      throw new Error(
        "An emergency department bed cannot be used for an inpatient admission",
      );
    }

    /*
     * --------------------------------------------------------
     * 6. Lock target bed
     * --------------------------------------------------------
     */
    const targetBedResult = await client.query(
      `
          SELECT
            b.bed_id,
            b.ward_id,
            b.bed_number,
            b.bed_type,
            b.status
          FROM public.beds b
          INNER JOIN public.wards w
            ON w.ward_id = b.ward_id
          WHERE
            b.bed_id = $1
            AND b.ward_id = $2
            AND w.hospital_id = $3
            AND w.is_active = TRUE
          FOR UPDATE;
        `,
      [bedId, wardId, hospitalId],
    );

    if (targetBedResult.rowCount === 0) {
      throw new Error(
        "Selected admission bed does not belong to the selected ward",
      );
    }

    const targetBed = targetBedResult.rows[0];

    if (targetBed.status !== "AVAILABLE") {
      throw new Error(
        `Selected admission bed is not available. Current status: ${targetBed.status}`,
      );
    }

    /*
     * --------------------------------------------------------
     * 7. Lock current emergency location
     * --------------------------------------------------------
     */
    const currentLocationResult = await client.query(
      `
          SELECT
            emergency_case_location_id,
            emergency_case_id,
            bed_id,
            location_type,
            started_at
          FROM public.emergency_case_locations
          WHERE
            emergency_case_id = $1
            AND ended_at IS NULL
          FOR UPDATE;
        `,
      [emergencyCaseId],
    );

    const currentLocation =
      currentLocationResult.rowCount > 0 ? currentLocationResult.rows[0] : null;

    /*
     * Prevent accidentally assigning the same bed as
     * both the old emergency location and the admission.
     */
    if (currentLocation && Number(currentLocation.bed_id) === Number(bedId)) {
      throw new Error(
        "The selected admission bed is already the emergency case's current bed",
      );
    }

    /*
     * --------------------------------------------------------
     * 8. Create/reuse inpatient encounter
     * --------------------------------------------------------
     *
     * If the emergency case already has an encounter,
     * preserve that clinical encounter.
     *
     * This is important for identified emergency patients.
     *
     * If the patient was originally unidentified, there may
     * be no encounter. In that situation create the inpatient
     * encounter now that identity has been confirmed.
     */
    let encounterId = emergencyCase.encounter_id;

    if (!encounterId) {
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
              'WARD',
              COALESCE(
                $3::timestamp,
                CURRENT_TIMESTAMP
              ),
              $4,
              'OPEN',
              $5,
              $6
            )
            RETURNING encounter_id;
          `,
        [
          patient.patient_id,
          hospitalId,
          admissionDate || null,
          ward.ward_name,
          emergencyCase.chief_complaint || null,
          emergencyCase.initial_condition || null,
        ],
      );

      encounterId = encounterResult.rows[0].encounter_id;

      await client.query(
        `
          UPDATE public.emergency_cases
          SET
            encounter_id = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE
            emergency_case_id = $2;
        `,
        [encounterId, emergencyCaseId],
      );
    }

    /*
     * --------------------------------------------------------
     * 9. Generate admission number when not supplied
     * --------------------------------------------------------
     */
    const finalAdmissionNumber =
      admissionNumber && String(admissionNumber).trim()
        ? String(admissionNumber).trim()
        : `ADM-EMG-${emergencyCaseId}-${Date.now()}`;

    /*
     * --------------------------------------------------------
     * 10. Create admission
     * --------------------------------------------------------
     */
    const admissionResult = await client.query(
      `
          INSERT INTO public.admissions (
            patient_id,
            encounter_id,
            ward_id,
            bed_id,
            admission_number,
            admission_date,
            admission_reason,
            admission_diagnosis,
            attending_doctor_id,
            status
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
            'ADMITTED'
          )
          RETURNING *;
        `,
      [
        patient.patient_id,
        encounterId,
        wardId,
        bedId,
        finalAdmissionNumber,
        admissionDate || null,
        admissionReason || emergencyCase.chief_complaint || null,
        admissionDiagnosis || null,
        attendingDoctorId || null,
      ],
    );

    const admission = admissionResult.rows[0];

    /*
     * --------------------------------------------------------
     * 11. Occupy target bed
     * --------------------------------------------------------
     */
    const occupiedResult = await client.query(
      `
          UPDATE public.beds
          SET
            status = 'OCCUPIED',
            updated_at = CURRENT_TIMESTAMP
          WHERE
            bed_id = $1
            AND ward_id = $2
            AND status = 'AVAILABLE'
          RETURNING
            bed_id,
            bed_number,
            status;
        `,
      [bedId, wardId],
    );

    if (occupiedResult.rowCount === 0) {
      throw new Error("Unable to mark the admission bed as occupied");
    }

    /*
     * --------------------------------------------------------
     * 12. End previous emergency location
     * --------------------------------------------------------
     */
    if (currentLocation) {
      await client.query(
        `
          UPDATE public.emergency_case_locations
          SET
            ended_at = CURRENT_TIMESTAMP
          WHERE
            emergency_case_location_id = $1
            AND ended_at IS NULL;
        `,
        [currentLocation.emergency_case_location_id],
      );

      /*
       * Release the old emergency bed.
       */
      const releasedResult = await client.query(
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

      if (releasedResult.rowCount === 0) {
        throw new Error("Unable to release the previous emergency bed");
      }
    }

    /*
     * --------------------------------------------------------
     * 13. Record the new Ward/ICU location
     * --------------------------------------------------------
     */
    const newLocationType = wardType === "ICU" ? "ICU" : "WARD";

    const locationResult = await client.query(
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
        newLocationType,
        attendingDoctorId || null,
        `Inpatient admission ${finalAdmissionNumber}`,
      ],
    );

    /*
     * --------------------------------------------------------
     * 14. Keep emergency case identified
     * --------------------------------------------------------
     *
     * IDENTIFIED represents successful identity resolution.
     *
     * We do NOT mark the emergency case DISCHARGED here,
     * because the patient is still receiving inpatient care.
     */
    await client.query(
      `
        UPDATE public.emergency_cases
        SET
          status = 'IDENTIFIED',
          updated_at = CURRENT_TIMESTAMP
        WHERE
          emergency_case_id = $1;
      `,
      [emergencyCaseId],
    );

    await client.query("COMMIT");

    return {
      emergencyCaseId,
      patient,
      encounterId,
      admission,
      location: locationResult.rows[0],
      bed: {
        bedId: occupiedResult.rows[0].bed_id,
        bedNumber: occupiedResult.rows[0].bed_number,
        status: occupiedResult.rows[0].status,
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
 * Discharge an admitted inpatient.
 *
 * The complete operation runs inside one PostgreSQL transaction so the
 * admission, encounter, bed and emergency episode remain consistent.
 */
async function dischargeAdmission({
  hospitalId,
  admissionId,
  dischargeDiagnosis,
  dischargeSummary,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const admissionResult = await client.query(
      `
        SELECT
          a.admission_id,
          a.patient_id,
          a.encounter_id,
          a.ward_id,
          a.bed_id,
          a.admission_number,
          a.admission_date,
          a.status,
          w.hospital_id,
          w.ward_name,
          w.ward_type
        FROM public.admissions a
        INNER JOIN public.wards w
          ON w.ward_id = a.ward_id
        WHERE
          a.admission_id = $1
          AND w.hospital_id = $2
        FOR UPDATE OF a;
      `,
      [admissionId, hospitalId],
    );

    if (admissionResult.rowCount === 0) {
      throw new Error("Admission not found for the authenticated hospital");
    }

    const admission = admissionResult.rows[0];

    if (admission.status !== "ADMITTED") {
      throw new Error(
        `Admission cannot be discharged because its current status is ${admission.status}`,
      );
    }

    const bedResult = await client.query(
      `
        SELECT
          bed_id,
          ward_id,
          bed_number,
          status
        FROM public.beds
        WHERE
          bed_id = $1
          AND ward_id = $2
        FOR UPDATE;
      `,
      [admission.bed_id, admission.ward_id],
    );

    if (bedResult.rowCount === 0) {
      throw new Error("Admission bed could not be found.");
    }

    const bed = bedResult.rows[0];

    if (bed.status !== "OCCUPIED") {
      throw new Error(
        `Admission bed is not currently occupied. Current status: ${bed.status}`,
      );
    }

    const encounterResult = await client.query(
      `
        SELECT
          encounter_id,
          patient_id,
          hospital_id,
          status
        FROM public.encounters
        WHERE
          encounter_id = $1
          AND patient_id = $2
          AND hospital_id = $3
        FOR UPDATE;
      `,
      [admission.encounter_id, admission.patient_id, hospitalId],
    );

    if (encounterResult.rowCount === 0) {
      throw new Error(
        "The admission's encounter could not be found for the authenticated hospital.",
      );
    }

    const encounter = encounterResult.rows[0];

    if (encounter.status !== "OPEN" && encounter.status !== "COMPLETED") {
      throw new Error(
        `The admission's encounter cannot be completed from its current status: ${encounter.status}`,
      );
    }

    const emergencyResult = await client.query(
      `
        SELECT
          emergency_case_id,
          encounter_id,
          status,
          patient_id,
          unidentified_patient
        FROM public.emergency_cases
        WHERE
          encounter_id = $1
          AND hospital_id = $2
        FOR UPDATE;
      `,
      [admission.encounter_id, hospitalId],
    );

    const emergencyCase =
      emergencyResult.rowCount > 0 ? emergencyResult.rows[0] : null;

    if (emergencyCase) {
      const locationResult = await client.query(
        `
          SELECT
            emergency_case_location_id,
            emergency_case_id,
            bed_id,
            location_type,
            started_at
          FROM public.emergency_case_locations
          WHERE
            emergency_case_id = $1
            AND ended_at IS NULL
          FOR UPDATE;
        `,
        [emergencyCase.emergency_case_id],
      );

      if (locationResult.rowCount > 0) {
        const activeLocation = locationResult.rows[0];

        if (Number(activeLocation.bed_id) !== Number(admission.bed_id)) {
          throw new Error(
            "The active emergency location bed does not match the admission bed.",
          );
        }

        await client.query(
          `
            UPDATE public.emergency_case_locations
            SET
              ended_at = CURRENT_TIMESTAMP
            WHERE
              emergency_case_location_id = $1
              AND ended_at IS NULL;
          `,
          [activeLocation.emergency_case_location_id],
        );
      }
    }

    const updatedAdmissionResult = await client.query(
      `
        UPDATE public.admissions
        SET
          status = 'DISCHARGED',
          discharge_date = CURRENT_TIMESTAMP,
          discharge_diagnosis = $2,
          discharge_summary = $3
        WHERE
          admission_id = $1
          AND status = 'ADMITTED'
        RETURNING *;
      `,
      [admissionId, dischargeDiagnosis, dischargeSummary],
    );

    if (updatedAdmissionResult.rowCount === 0) {
      throw new Error(
        "The admission could not be discharged because its status changed during the operation.",
      );
    }

    await client.query(
      `
        UPDATE public.encounters
        SET
          status = 'COMPLETED'
        WHERE
          encounter_id = $1
          AND patient_id = $2
          AND hospital_id = $3;
      `,
      [admission.encounter_id, admission.patient_id, hospitalId],
    );

    const releasedBedResult = await client.query(
      `
        UPDATE public.beds
        SET
          status = 'AVAILABLE',
          updated_at = CURRENT_TIMESTAMP
        WHERE
          bed_id = $1
          AND ward_id = $2
          AND status = 'OCCUPIED'
        RETURNING
          bed_id,
          bed_number,
          status;
      `,
      [admission.bed_id, admission.ward_id],
    );

    if (releasedBedResult.rowCount === 0) {
      throw new Error("Unable to release the admission bed.");
    }

    if (emergencyCase) {
      await client.query(
        `
          UPDATE public.emergency_cases
          SET
            status = 'DISCHARGED',
            updated_at = CURRENT_TIMESTAMP
          WHERE
            emergency_case_id = $1;
        `,
        [emergencyCase.emergency_case_id],
      );
    }

    await client.query("COMMIT");

    return {
      admission: updatedAdmissionResult.rows[0],
      bed: releasedBedResult.rows[0],
      encounter: {
        encounterId: admission.encounter_id,
        status: "COMPLETED",
      },
      emergencyCase: emergencyCase
        ? {
            emergencyCaseId: emergencyCase.emergency_case_id,
            status: "DISCHARGED",
          }
        : null,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get admissions for a patient within the authenticated hospital.
 */
async function getPatientAdmissions(hospitalId, patientId) {
  const query = `
    SELECT
      a.admission_id,
      a.admission_number,
      a.admission_date,
      a.discharge_date,
      a.admission_reason,
      a.admission_diagnosis,
      a.discharge_diagnosis,
      a.discharge_summary,
      a.status,

      e.encounter_id,
      e.encounter_type,

      w.ward_id,
      w.ward_code,
      w.ward_name,
      w.ward_type,

      b.bed_id,
      b.bed_number,

      u.user_id AS doctor_id,
      u.full_name AS doctor_name,

      h.hospital_id,
      h.hospital_name

    FROM public.admissions a

    INNER JOIN public.encounters e
      ON e.encounter_id = a.encounter_id

    INNER JOIN public.wards w
      ON w.ward_id = a.ward_id

    INNER JOIN public.beds b
      ON b.bed_id = a.bed_id

    LEFT JOIN public.hospital_users u
      ON u.user_id = a.attending_doctor_id

    INNER JOIN public.hospitals h
      ON h.hospital_id = w.hospital_id

    WHERE
      a.patient_id = $1
      AND w.hospital_id = $2

    ORDER BY
      a.admission_date DESC;
  `;

  const result = await pool.query(query, [patientId, hospitalId]);

  return result.rows;
}

/**
 * Get one admission belonging to the authenticated hospital.
 */
async function getAdmissionById(hospitalId, admissionId) {
  const query = `
    SELECT
      a.admission_id,
      a.admission_number,
      a.admission_date,
      a.discharge_date,
      a.admission_reason,
      a.admission_diagnosis,
      a.discharge_diagnosis,
      a.discharge_summary,
      a.status,

      p.patient_id,
      p.patient_number,
      p.first_name,
      p.last_name,

      w.ward_id,
      w.ward_code,
      w.ward_name,
      w.ward_type,

      b.bed_id,
      b.bed_number,

      u.user_id AS doctor_id,
      u.full_name AS doctor_name,

      h.hospital_id,
      h.hospital_name

    FROM public.admissions a

    INNER JOIN public.patients p
      ON p.patient_id = a.patient_id

    INNER JOIN public.wards w
      ON w.ward_id = a.ward_id

    INNER JOIN public.beds b
      ON b.bed_id = a.bed_id

    LEFT JOIN public.hospital_users u
      ON u.user_id = a.attending_doctor_id

    INNER JOIN public.hospitals h
      ON h.hospital_id = w.hospital_id

    WHERE
      a.admission_id = $1
      AND w.hospital_id = $2;
  `;

  const result = await pool.query(query, [admissionId, hospitalId]);

  return result.rows[0] || null;
}

/**
 * Discharge an admitted inpatient.
 *
 * All related changes are performed in one transaction so the admission,
 * encounter, bed and emergency episode remain consistent.
 */
async function dischargeAdmission({
  hospitalId,
  admissionId,
  dischargeDiagnosis,
  dischargeSummary,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const admissionResult = await client.query(
      `
          SELECT
            a.admission_id,
            a.patient_id,
            a.encounter_id,
            a.ward_id,
            a.bed_id,
            a.admission_number,
            a.admission_date,
            a.status,
            w.hospital_id,
            w.ward_name,
            w.ward_type
          FROM public.admissions a
          INNER JOIN public.wards w
            ON w.ward_id = a.ward_id
          WHERE
            a.admission_id = $1
            AND w.hospital_id = $2
          FOR UPDATE OF a;
        `,
      [admissionId, hospitalId],
    );

    if (admissionResult.rowCount === 0) {
      throw new Error("Admission not found for the authenticated hospital");
    }

    const admission = admissionResult.rows[0];

    if (admission.status !== "ADMITTED") {
      throw new Error(
        `Admission cannot be discharged because its current status is ${admission.status}`,
      );
    }

    const bedResult = await client.query(
      `
          SELECT
            bed_id,
            ward_id,
            bed_number,
            status
          FROM public.beds
          WHERE
            bed_id = $1
            AND ward_id = $2
          FOR UPDATE;
        `,
      [admission.bed_id, admission.ward_id],
    );

    if (bedResult.rowCount === 0) {
      throw new Error("Admission bed could not be found.");
    }

    const bed = bedResult.rows[0];

    if (bed.status !== "OCCUPIED") {
      throw new Error(
        `Admission bed is not currently occupied. Current status: ${bed.status}`,
      );
    }

    const encounterResult = await client.query(
      `
          SELECT
            encounter_id,
            patient_id,
            hospital_id,
            status
          FROM public.encounters
          WHERE
            encounter_id = $1
            AND patient_id = $2
            AND hospital_id = $3
          FOR UPDATE;
        `,
      [admission.encounter_id, admission.patient_id, hospitalId],
    );

    if (encounterResult.rowCount === 0) {
      throw new Error(
        "The admission's encounter could not be found for the authenticated hospital.",
      );
    }

    const encounter = encounterResult.rows[0];

    if (encounter.status !== "OPEN" && encounter.status !== "COMPLETED") {
      throw new Error(
        `The admission's encounter cannot be completed from its current status: ${encounter.status}`,
      );
    }

    /*
     * Determine whether this admission belongs
     * to an emergency episode.
     */
    const emergencyResult = await client.query(
      `
          SELECT
            emergency_case_id,
            encounter_id,
            patient_id,
            status
          FROM public.emergency_cases
          WHERE
            encounter_id = $1
            AND hospital_id = $2
          FOR UPDATE;
        `,
      [admission.encounter_id, hospitalId],
    );

    const emergencyCase =
      emergencyResult.rowCount > 0 ? emergencyResult.rows[0] : null;

    /*
     * Close the active emergency physical location
     * when this admission originated from emergency.
     */
    if (emergencyCase) {
      const locationResult = await client.query(
        `
            SELECT
              emergency_case_location_id,
              emergency_case_id,
              bed_id,
              location_type
            FROM public.emergency_case_locations
            WHERE
              emergency_case_id = $1
              AND ended_at IS NULL
            FOR UPDATE;
          `,
        [emergencyCase.emergency_case_id],
      );

      if (locationResult.rowCount > 0) {
        const activeLocation = locationResult.rows[0];

        if (Number(activeLocation.bed_id) !== Number(admission.bed_id)) {
          throw new Error(
            "The active emergency location bed does not match the admission bed.",
          );
        }

        await client.query(
          `
            UPDATE public.emergency_case_locations
            SET
              ended_at = CURRENT_TIMESTAMP
            WHERE
              emergency_case_location_id = $1
              AND ended_at IS NULL;
          `,
          [activeLocation.emergency_case_location_id],
        );
      }
    }

    /*
     * Mark admission as discharged.
     */
    const updatedAdmissionResult = await client.query(
      `
          UPDATE public.admissions
          SET
            status = 'DISCHARGED',
            discharge_date = CURRENT_TIMESTAMP,
            discharge_diagnosis = $2,
            discharge_summary = $3
          WHERE
            admission_id = $1
            AND status = 'ADMITTED'
          RETURNING *;
        `,
      [admissionId, dischargeDiagnosis, dischargeSummary],
    );

    if (updatedAdmissionResult.rowCount === 0) {
      throw new Error(
        "The admission could not be discharged because its status changed during the operation.",
      );
    }

    /*
     * Complete the associated clinical encounter.
     */
    await client.query(
      `
        UPDATE public.encounters
        SET
          status = 'COMPLETED'
        WHERE
          encounter_id = $1
          AND patient_id = $2
          AND hospital_id = $3;
      `,
      [admission.encounter_id, admission.patient_id, hospitalId],
    );

    /*
     * Release the occupied bed.
     */
    const releasedBedResult = await client.query(
      `
          UPDATE public.beds
          SET
            status = 'AVAILABLE',
            updated_at = CURRENT_TIMESTAMP
          WHERE
            bed_id = $1
            AND ward_id = $2
            AND status = 'OCCUPIED'
          RETURNING
            bed_id,
            bed_number,
            status;
        `,
      [admission.bed_id, admission.ward_id],
    );

    if (releasedBedResult.rowCount === 0) {
      throw new Error("Unable to release the admission bed.");
    }

    /*
     * Only now, after inpatient discharge, close the
     * emergency episode when applicable.
     */
    if (emergencyCase) {
      await client.query(
        `
          UPDATE public.emergency_cases
          SET
            status = 'DISCHARGED',
            updated_at = CURRENT_TIMESTAMP
          WHERE
            emergency_case_id = $1;
        `,
        [emergencyCase.emergency_case_id],
      );
    }

    await client.query("COMMIT");

    return {
      admission: updatedAdmissionResult.rows[0],

      bed: releasedBedResult.rows[0],

      encounter: {
        encounterId: admission.encounter_id,
        status: "COMPLETED",
      },

      emergencyCase: emergencyCase
        ? {
            emergencyCaseId: emergencyCase.emergency_case_id,

            status: "DISCHARGED",
          }
        : null,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createAdmission,
  createEmergencyAdmission,
  getPatientAdmissions,
  getAdmissionById,
  dischargeAdmission,
};
