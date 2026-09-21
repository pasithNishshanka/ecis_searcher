const pool = require("../config/database");

/**
 * Create an inpatient admission and assign the selected bed.
 *
 * Everything happens inside one database transaction:
 *
 * 1. Verify patient.
 * 2. Verify ward.
 * 3. Lock bed.
 * 4. Verify bed availability.
 * 5. Verify patient has no active admission.
 * 6. Create encounter.
 * 7. Create admission.
 * 8. Mark bed as occupied.
 *
 * If anything fails, everything is rolled back.
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

    /*
     * --------------------------------------------------------
     * 1. Verify patient belongs to authenticated hospital
     * --------------------------------------------------------
     */
    const patientResult = await client.query(
      `
        SELECT
          patient_id,
          hospital_id,
          patient_number,
          first_name,
          last_name
        FROM patients
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
        "Active patient not found for the selected hospital",
      );
    }

    /*
     * --------------------------------------------------------
     * 2. Verify ward belongs to authenticated hospital
     * --------------------------------------------------------
     */
    const wardResult = await client.query(
      `
        SELECT
          ward_id,
          hospital_id,
          ward_name,
          capacity,
          is_active
        FROM wards
        WHERE
          ward_id = $1
          AND hospital_id = $2
          AND is_active = TRUE
        FOR SHARE;
      `,
      [
        wardId,
        hospitalId,
      ],
    );

    if (wardResult.rowCount === 0) {
      throw new Error(
        "Active ward not found for the selected hospital",
      );
    }

    /*
     * --------------------------------------------------------
     * 3. Lock selected bed
     * --------------------------------------------------------
     */
    const bedResult = await client.query(
      `
        SELECT
          b.bed_id,
          b.ward_id,
          b.bed_number,
          b.bed_type,
          b.status
        FROM beds b
        INNER JOIN wards w
          ON w.ward_id = b.ward_id
        WHERE
          b.bed_id = $1
          AND b.ward_id = $2
          AND w.hospital_id = $3
          AND w.is_active = TRUE
        FOR UPDATE;
      `,
      [
        bedId,
        wardId,
        hospitalId,
      ],
    );

    if (bedResult.rowCount === 0) {
      throw new Error(
        "Selected bed does not belong to the selected ward",
      );
    }

    const bed = bedResult.rows[0];

    /*
     * --------------------------------------------------------
     * 4. Make sure bed is actually available
     * --------------------------------------------------------
     */
    if (bed.status !== "AVAILABLE") {
      throw new Error(
        `Selected bed is not available. Current status: ${bed.status}`,
      );
    }

    /*
     * --------------------------------------------------------
     * 5. Make sure patient has no active admission
     * --------------------------------------------------------
     */
    const activeAdmissionResult =
      await client.query(
        `
          SELECT
            admission_id,
            admission_number,
            ward_id,
            bed_id
          FROM admissions
          WHERE
            patient_id = $1
            AND status = 'ADMITTED'
          LIMIT 1
          FOR SHARE;
        `,
        [patientId],
      );

    if (activeAdmissionResult.rowCount > 0) {
      throw new Error(
        "Patient already has an active admission",
      );
    }

    /*
     * --------------------------------------------------------
     * 6. Create encounter
     * --------------------------------------------------------
     */
    const encounterResult =
      await client.query(
        `
          INSERT INTO encounters (
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

    const encounterId =
      encounterResult.rows[0].encounter_id;

    /*
     * --------------------------------------------------------
     * 7. Create admission
     * --------------------------------------------------------
     */
    const admissionResult =
      await client.query(
        `
          INSERT INTO admissions (
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

    const admission =
      admissionResult.rows[0];

    /*
     * --------------------------------------------------------
     * 8. Mark bed occupied
     * --------------------------------------------------------
     *
     * The bed was locked above, so another admission
     * cannot take it while this transaction is running.
     */
    const occupiedResult =
      await client.query(
        `
          UPDATE beds
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
        [
          bedId,
          wardId,
        ],
      );

    if (occupiedResult.rowCount === 0) {
      throw new Error(
        "Unable to mark the selected bed as occupied.",
      );
    }

    await client.query("COMMIT");

    return {
      encounterId,
      admission,
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
 * Get admissions for a patient within the authenticated hospital.
 */
async function getPatientAdmissions(
  hospitalId,
  patientId,
) {
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

      b.bed_id,
      b.bed_number,

      u.user_id AS doctor_id,
      u.full_name AS doctor_name,

      h.hospital_id,
      h.hospital_name

    FROM admissions a

    INNER JOIN encounters e
      ON e.encounter_id = a.encounter_id

    INNER JOIN wards w
      ON w.ward_id = a.ward_id

    INNER JOIN beds b
      ON b.bed_id = a.bed_id

    LEFT JOIN hospital_users u
      ON u.user_id = a.attending_doctor_id

    INNER JOIN hospitals h
      ON h.hospital_id = w.hospital_id

    WHERE
      a.patient_id = $1
      AND w.hospital_id = $2

    ORDER BY
      a.admission_date DESC;
  `;

  const result = await pool.query(
    query,
    [
      patientId,
      hospitalId,
    ],
  );

  return result.rows;
}

/**
 * Get one admission belonging to the authenticated hospital.
 */
async function getAdmissionById(
  hospitalId,
  admissionId,
) {
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

      b.bed_id,
      b.bed_number,

      u.user_id AS doctor_id,
      u.full_name AS doctor_name,

      h.hospital_id,
      h.hospital_name

    FROM admissions a

    INNER JOIN patients p
      ON p.patient_id = a.patient_id

    INNER JOIN wards w
      ON w.ward_id = a.ward_id

    INNER JOIN beds b
      ON b.bed_id = a.bed_id

    LEFT JOIN hospital_users u
      ON u.user_id = a.attending_doctor_id

    INNER JOIN hospitals h
      ON h.hospital_id = w.hospital_id

    WHERE
      a.admission_id = $1
      AND w.hospital_id = $2;
  `;

  const result = await pool.query(
    query,
    [
      admissionId,
      hospitalId,
    ],
  );

  return result.rows[0] || null;
}

module.exports = {
  createAdmission,
  getPatientAdmissions,
  getAdmissionById,
};