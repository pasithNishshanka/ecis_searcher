/*
 * Remove the one generated 2,000-patient ECIS training dataset and all
 * clinical rows linked to it. Hospital, ward, bed, clinic, staff, and
 * authorization configuration is preserved.
 *
 * This deliberately has a strict, one-time guard: it only runs while the
 * patients table contains exactly P000001 through P002000 and no other
 * patient records. It must not be reused as a production data purge.
 *
 * Run only with: node scripts/removeGeneratedTrainingData.js --execute
 */

const fs = require("fs");
const crypto = require("crypto");

const pool = require("../src/config/database");
const { getStoragePath } = require("../src/middleware/radiologyUpload.middleware");

const PATIENT_PATTERN = "^P[0-9]{6}$";
const EXPECTED_PATIENT_COUNT = 2000;
const DEMO_WARD_CODES = ["WARD-1789995797575", "ECIS-W01", "ECIS-W02"];
const DEMO_CLINIC_CODES = ["ECIS-ORTHO", "ECIS-MED"];

const PATIENT_LINKED_TABLES = [
  "admissions",
  "bht_entries",
  "clinic_visits",
  "clinical_observations",
  "dental_records",
  "ecis_candidate_reviews",
  "emergency_cases",
  "encounters",
  "fractures",
  "investigations",
  "medical_devices",
  "medication_orders",
  "opd_visits",
  "patient_allergies",
  "patient_conditions",
  "patient_hospital_registrations",
  "procedures",
  "radiology_images",
  "surgeries",
  "treatment_records",
];

async function deletePatientRows(client, tableName) {
  const result = await client.query(
    `
      DELETE FROM public.${tableName} row_to_delete
      USING cleanup_demo_patients target
      WHERE row_to_delete.patient_id = target.patient_id;
    `,
  );

  return result.rowCount;
}

async function removeGeneratedTrainingData() {
  if (!process.argv.includes("--execute")) {
    throw new Error("No changes made. Re-run with --execute to remove the verified training dataset.");
  }

  const client = await pool.connect();
  const stagedFiles = [];
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;

    await client.query("SELECT pg_advisory_xact_lock(9130472);");

    const databaseName = await client.query("SELECT current_database() AS name;");
    if (databaseName.rows[0].name !== "ecis_ehr") {
      throw new Error("Safety stop: cleanup is restricted to the local ecis_ehr development database.");
    }

    const patientSummary = await client.query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE patient_number ~ $1)::int AS generated_count,
          COUNT(DISTINCT patient_number) FILTER (WHERE patient_number ~ $1)::int AS distinct_generated_count,
          MIN(patient_number) FILTER (WHERE patient_number ~ $1) AS first_number,
          MAX(patient_number) FILTER (WHERE patient_number ~ $1) AS last_number
        FROM public.patients;
      `,
      [PATIENT_PATTERN],
    );

    const summary = patientSummary.rows[0];
    if (
      summary.total !== EXPECTED_PATIENT_COUNT ||
      summary.generated_count !== EXPECTED_PATIENT_COUNT ||
      summary.distinct_generated_count !== EXPECTED_PATIENT_COUNT ||
      summary.first_number !== "P000001" ||
      summary.last_number !== "P002000"
    ) {
      throw new Error(
        `Safety stop: expected exactly P000001 through P002000 and no other patients; found ${summary.generated_count} matching of ${summary.total} total.`,
      );
    }

    await client.query(`
      CREATE TEMP TABLE cleanup_demo_patients (
        patient_id BIGINT PRIMARY KEY
      ) ON COMMIT DROP;
    `);

    await client.query(
      "SELECT patient_id FROM public.patients WHERE patient_number ~ $1 FOR UPDATE;",
      [PATIENT_PATTERN],
    );

    await client.query(
      `
        INSERT INTO cleanup_demo_patients (patient_id)
        SELECT patient_id
        FROM public.patients
        WHERE patient_number ~ $1;
      `,
      [PATIENT_PATTERN],
    );

    for (const tableName of PATIENT_LINKED_TABLES) {
      const remaining = await client.query(
        `
          SELECT COUNT(*)::int AS count
          FROM public.${tableName} row_to_check
          WHERE NOT EXISTS (
            SELECT 1
            FROM cleanup_demo_patients target
            WHERE target.patient_id = row_to_check.patient_id
          );
        `,
      );

      if (remaining.rows[0].count !== 0) {
        throw new Error(
          `Safety stop: ${tableName} contains ${remaining.rows[0].count} rows outside the generated patient set.`,
        );
      }
    }

    await client.query(`
      CREATE TEMP TABLE cleanup_demo_admissions (
        admission_id BIGINT PRIMARY KEY
      ) ON COMMIT DROP;

      INSERT INTO cleanup_demo_admissions (admission_id)
      SELECT admission_id
      FROM public.admissions a
      INNER JOIN cleanup_demo_patients p USING (patient_id);

      CREATE TEMP TABLE cleanup_demo_emergencies (
        emergency_case_id BIGINT PRIMARY KEY
      ) ON COMMIT DROP;

      INSERT INTO cleanup_demo_emergencies (emergency_case_id)
      SELECT emergency_case_id
      FROM public.emergency_cases e
      INNER JOIN cleanup_demo_patients p USING (patient_id);

      CREATE TEMP TABLE cleanup_demo_beds (
        bed_id BIGINT PRIMARY KEY
      ) ON COMMIT DROP;

      INSERT INTO cleanup_demo_beds (bed_id)
      SELECT DISTINCT bed_id
      FROM public.admissions a
      INNER JOIN cleanup_demo_patients p USING (patient_id)
      WHERE a.status = 'ADMITTED' AND bed_id IS NOT NULL;

      CREATE TEMP TABLE cleanup_demo_master_wards (
        ward_id BIGINT PRIMARY KEY
      ) ON COMMIT DROP;
    `);

    await client.query(
      `
        INSERT INTO cleanup_demo_master_wards (ward_id)
        SELECT ward_id
        FROM public.wards
        WHERE ward_code = ANY($1);
      `,
      [DEMO_WARD_CODES],
    );

    const wardReferences = await client.query(
      `
        SELECT
          (SELECT COUNT(*)::int FROM public.admissions a INNER JOIN cleanup_demo_master_wards w USING (ward_id)) AS admissions,
          (SELECT COUNT(*)::int FROM public.emergency_case_locations l INNER JOIN public.beds b USING (bed_id) INNER JOIN cleanup_demo_master_wards w USING (ward_id)) AS emergency_locations;
      `,
    );

    if (wardReferences.rows[0].admissions || wardReferences.rows[0].emergency_locations) {
      throw new Error("Safety stop: demo-labelled wards still have clinical or emergency location links.");
    }

    const clinicReferences = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM public.clinic_visits cv
        INNER JOIN public.clinics c USING (clinic_id)
        WHERE c.clinic_code = ANY($1);
      `,
      [DEMO_CLINIC_CODES],
    );

    if (clinicReferences.rows[0].count) {
      throw new Error("Safety stop: demo-labelled clinics still have clinical visit links.");
    }

    const imageResult = await client.query(
      `
        SELECT DISTINCT ri.storage_key
        FROM public.radiology_images ri
        INNER JOIN cleanup_demo_patients target USING (patient_id);
      `,
    );

    for (const row of imageResult.rows) {
      const originalPath = getStoragePath(row.storage_key);

      try {
        await fs.promises.access(originalPath, fs.constants.F_OK);
      } catch (error) {
        if (error.code === "ENOENT") {
          continue;
        }

        throw error;
      }

      const stagedPath = `${originalPath}.demo-cleanup-${crypto.randomUUID()}`;
      await fs.promises.rename(originalPath, stagedPath);
      stagedFiles.push({ originalPath, stagedPath });
    }

    const deleted = {};
    const orderedPatientTables = [
      "clinical_observations",
      "bht_entries",
      "patient_allergies",
      "radiology_image_access_logs",
      "radiology_images",
      "medication_dispensations",
      "surgeries",
      "medication_orders",
      "ecis_candidate_reviews",
      "ecis_search_logs",
      "treatment_records",
      "dental_records",
      "fractures",
      "procedures",
      "clinic_visits",
      "opd_visits",
      "admissions",
      "emergency_case_locations",
      "emergency_cases",
      "patient_conditions",
      "investigations",
      "medical_devices",
      "patient_hospital_registrations",
      "encounters",
      "patients",
    ];

    for (const tableName of orderedPatientTables) {
      if (PATIENT_LINKED_TABLES.includes(tableName)) {
        deleted[tableName] = await deletePatientRows(client, tableName);
        continue;
      }

      if (tableName === "radiology_image_access_logs") {
        const result = await client.query(`
          DELETE FROM public.radiology_image_access_logs access_log
          USING public.radiology_images image
          INNER JOIN cleanup_demo_patients target USING (patient_id)
          WHERE access_log.radiology_image_id = image.radiology_image_id;
        `);
        deleted[tableName] = result.rowCount;
        continue;
      }

      if (tableName === "medication_dispensations") {
        const result = await client.query(`
          DELETE FROM public.medication_dispensations dispensation
          USING public.medication_orders medication
          INNER JOIN cleanup_demo_patients target USING (patient_id)
          WHERE dispensation.medication_order_id = medication.medication_order_id;
        `);
        deleted[tableName] = result.rowCount;
        continue;
      }

      if (tableName === "ecis_search_logs") {
        const result = await client.query(`
          DELETE FROM public.ecis_search_logs search_log
          USING cleanup_demo_emergencies target
          WHERE search_log.emergency_case_id = target.emergency_case_id;
        `);
        deleted[tableName] = result.rowCount;
        continue;
      }

      if (tableName === "emergency_case_locations") {
        const result = await client.query(`
          DELETE FROM public.emergency_case_locations location
          USING cleanup_demo_emergencies target
          WHERE location.emergency_case_id = target.emergency_case_id;
        `);
        deleted[tableName] = result.rowCount;
        continue;
      }

      if (tableName === "patients") {
        const result = await client.query(`
          DELETE FROM public.patients patient
          USING cleanup_demo_patients target
          WHERE patient.patient_id = target.patient_id;
        `);
        deleted[tableName] = result.rowCount;
      }
    }

    const deletedOrphanSearchLogs = await client.query(`
      DELETE FROM public.ecis_search_logs
      WHERE emergency_case_id IS NULL;
    `);
    deleted.ecis_search_logs_orphaned = deletedOrphanSearchLogs.rowCount;

    const deletedOrphanAuditEvents = await client.query(`
      DELETE FROM public.audit_logs
      WHERE
        entity_type = 'emergency_case'
        AND action_type = 'ECIS_IDENTITY_CONFIRMED'
        AND entity_id::text NOT IN (
          SELECT emergency_case_id::text
          FROM public.emergency_cases
        );
    `);
    deleted.orphaned_demo_emergency_audit = deletedOrphanAuditEvents.rowCount;

    const releasedBeds = await client.query(`
      UPDATE public.beds b
      SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP
      FROM cleanup_demo_beds target
      WHERE
        b.bed_id = target.bed_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.admissions a
          WHERE a.bed_id = b.bed_id AND a.status = 'ADMITTED'
        );
    `);
    deleted.demo_beds_released = releasedBeds.rowCount;

    const demoFixtureBeds = await client.query(`
      DELETE FROM public.beds b
      USING cleanup_demo_master_wards target
      WHERE b.ward_id = target.ward_id;
    `);
    deleted.demo_fixture_beds = demoFixtureBeds.rowCount;

    const demoFixtureWards = await client.query(`
      DELETE FROM public.wards w
      USING cleanup_demo_master_wards target
      WHERE w.ward_id = target.ward_id;
    `);
    deleted.demo_fixture_wards = demoFixtureWards.rowCount;

    const demoFixtureClinics = await client.query(
      "DELETE FROM public.clinics WHERE clinic_code = ANY($1);",
      [DEMO_CLINIC_CODES],
    );
    deleted.demo_fixture_clinics = demoFixtureClinics.rowCount;

    const remainingPatients = await client.query(
      "SELECT COUNT(*)::int AS count FROM public.patients WHERE patient_number ~ $1;",
      [PATIENT_PATTERN],
    );

    if (remainingPatients.rows[0].count !== 0) {
      throw new Error("Safety stop: generated patient rows remain after cleanup.");
    }

    await client.query("COMMIT");
    transactionOpen = false;

    const fileCleanup = [];
    for (const file of stagedFiles) {
      try {
        await fs.promises.unlink(file.stagedPath);
        fileCleanup.push({ removed: true });
      } catch (error) {
        fileCleanup.push({ removed: false, error: error.message });
      }
    }

    console.log(JSON.stringify({
      deleted,
      generatedPatientsRemoved: EXPECTED_PATIENT_COUNT,
      radiologyFilesRemoved: fileCleanup.filter((item) => item.removed).length,
      radiologyFileCleanupErrors: fileCleanup.filter((item) => !item.removed),
      preserved: ["hospital and staff accounts", "general ward/bed/clinic configuration", "allergy and condition lookup tables"],
    }, null, 2));
  } catch (error) {
    if (transactionOpen) {
      await client.query("ROLLBACK");
      transactionOpen = false;
    }

    for (const file of stagedFiles.reverse()) {
      try {
        await fs.promises.rename(file.stagedPath, file.originalPath);
      } catch (restoreError) {
        console.error(`Unable to restore staged radiology file: ${restoreError.message}`);
      }
    }

    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

removeGeneratedTrainingData().catch((error) => {
  console.error(`Demo data cleanup stopped: ${error.message}`);
  process.exitCode = 1;
});
