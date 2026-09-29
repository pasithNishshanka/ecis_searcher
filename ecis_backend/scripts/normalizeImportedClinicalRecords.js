/*
 * One-time cleanup of the existing generated ECIS records. It changes only
 * rows belonging to the verified 3,000-patient import. Original rows are
 * retained in record_normalization_backup in the same transaction.
 *
 * Run from ecis_backend: node scripts/normalizeImportedClinicalRecords.js --execute
 */

const pool = require("../src/config/database");

const PREFIX = "SYNTHETIC TRAINING ONLY — NOT FOR CLINICAL CARE. ";
const PATIENT_TABLES = {
  patients: ["registration_notes"],
  patient_hospital_registrations: ["notes"],
  patient_conditions: ["notes"],
  encounters: ["notes"],
  opd_visits: ["clinical_notes", "opd_number"],
  clinic_visits: ["clinical_notes", "visit_number"],
  emergency_cases: ["initial_condition", "case_number"],
  admissions: ["admission_reason", "discharge_summary", "admission_number"],
  bht_entries: ["entry_title", "subjective_notes", "objective_notes", "plan"],
  clinical_observations: ["notes"],
  treatment_records: ["description", "outcome"],
  investigations: ["result_summary", "reference_range", "priority", "clinical_notes", "report_reference"],
  medication_orders: ["instructions", "prescribed_notes"],
  surgeries: ["surgery_code", "findings", "complications", "surgical_notes"],
  procedures: ["procedure_code", "indication", "findings", "outcome"],
  fractures: ["treatment_description", "notes"],
  dental_records: ["notes"],
  medical_devices: ["manufacturer", "model_number", "serial_number", "notes"],
};

const CLINICAL_NOTES = new Map([
  ["Longitudinal glucose review in a fictional training case", "Glucose control, diet and medication use reviewed."],
  ["Headache history documented for training", "Headache pattern, triggers and associated symptoms reviewed."],
  ["Short-duration respiratory symptoms in a fictional case", "Duration of cough, throat symptoms and respiratory findings reviewed."],
  ["Dietary and symptom history in a synthetic scenario", "Meals, symptom timing and associated abdominal discomfort reviewed."],
  ["Skin symptoms documented for software training", "Rash distribution, duration and possible triggers reviewed."],
  ["Mobility and pain history in the synthetic record", "Knee pain and its effect on walking reviewed."],
  ["Back symptoms documented for training", "Back pain, mobility and aggravating movements reviewed."],
  ["Respiratory symptom review in a fictional record", "Wheeze, exertional symptoms and inhaler use reviewed."],
  ["Symptom and hydration history documented for training", "Postural symptoms, fluid intake and medication history reviewed."],
  ["Recovery review for a synthetic visit", "Recovery and residual symptoms after minor injury reviewed."],
  ["Medication-reconciliation scenario; fictional details only", "Current medications, adherence and reported effects reviewed."],
]);

const ARTIFICIAL_WORDS = "synthetic|training|fictional|illustrative|demo|viva|software testing|interface testing|workflow testing|not real|not measured|not for clinical|no real care|no operation took place";

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function normalizedExpression(column) {
  const remainder = `btrim(substring(${column} from char_length($2) + 1))`;
  const mapped = [...CLINICAL_NOTES].map(([oldText, newText]) =>
    `WHEN ${quote(oldText)} THEN ${quote(newText)}`,
  ).join(" ");
  return `CASE ${remainder} ${mapped} ELSE CASE WHEN ${remainder} ~* ${quote(ARTIFICIAL_WORDS)} THEN NULL ELSE NULLIF(${remainder}, '') END END`;
}

async function main() {
  if (!process.argv.includes("--execute")) {
    throw new Error("No records changed. Pass --execute after reviewing this script.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const identity = await client.query("SELECT current_database() AS database_name, inet_server_addr()::text AS server_address");
    const { database_name: databaseName, server_address: serverAddress } = identity.rows[0];
    if (databaseName !== "ecis_ehr" || !["127.0.0.1", "127.0.0.1/32", "::1", "::1/128", null].includes(serverAddress)) {
      throw new Error("This cleanup is restricted to the local ecis_ehr database.");
    }

    const patients = await client.query(
      "SELECT patient_id FROM public.patients WHERE registration_notes LIKE $1 ORDER BY patient_id",
      [`${PREFIX}%`],
    );
    const total = await client.query("SELECT count(*)::int AS n FROM public.patients");
    if (patients.rowCount !== 3000 || total.rows[0].n !== 3000) {
      throw new Error(`Expected exactly 3,000 imported patients; found ${patients.rowCount} marked of ${total.rows[0].n} total.`);
    }
    const patientIds = patients.rows.map((row) => row.patient_id);
    const actor = await client.query(
      "SELECT user_id FROM public.hospital_users WHERE employee_number = $1 AND role = $2",
      ["SYNTHETIC-DATASET-001", "DATASET_GENERATOR"],
    );
    if (actor.rowCount !== 1) throw new Error("The expected import service account was not found.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.record_normalization_backup (
        backup_id BIGSERIAL PRIMARY KEY,
        source_table TEXT NOT NULL,
        original_row JSONB NOT NULL,
        captured_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    for (const table of Object.keys(PATIENT_TABLES)) {
      await client.query(
        `INSERT INTO public.record_normalization_backup (source_table, original_row)
         SELECT $2, to_jsonb(t) FROM public.${table} t WHERE t.patient_id = ANY($1::bigint[])`,
        [patientIds, table],
      );
    }
    await client.query(
      `INSERT INTO public.record_normalization_backup (source_table, original_row)
       SELECT 'emergency_case_locations', to_jsonb(l)
       FROM public.emergency_case_locations l
       JOIN public.emergency_cases e ON e.emergency_case_id = l.emergency_case_id
       WHERE e.patient_id = ANY($1::bigint[])`,
      [patientIds],
    );
    await client.query(
      `INSERT INTO public.record_normalization_backup (source_table, original_row)
       SELECT 'hospital_users', to_jsonb(u) FROM public.hospital_users u WHERE u.user_id = $1`,
      [actor.rows[0].user_id],
    );

    const changes = {};
    for (const [table, columns] of Object.entries(PATIENT_TABLES)) {
      for (const column of columns) {
        if (["entry_title", "opd_number", "visit_number", "case_number", "admission_number", "reference_range", "priority", "report_reference", "instructions", "surgery_code", "complications", "procedure_code", "manufacturer", "model_number", "serial_number"].includes(column)) continue;
        const expression = normalizedExpression(column);
        const result = await client.query(
          `UPDATE public.${table} SET ${column} = ${expression}
           WHERE patient_id = ANY($1::bigint[]) AND ${column} LIKE $2 || '%'`,
          [patientIds, PREFIX],
        );
        if (result.rowCount) changes[`${table}.${column}`] = result.rowCount;
      }
    }

    const updates = [
      ["patients", "registration_notes = NULL", "registration_notes IS NOT NULL"],
      ["patient_hospital_registrations", "notes = NULL", "notes IS NOT NULL"],
      ["admissions", "admission_reason = admission_diagnosis", "admission_reason IS NULL"],
      ["admissions", "discharge_summary = 'Discharge diagnosis: ' || discharge_diagnosis", "discharge_summary IS NULL AND discharge_diagnosis IS NOT NULL"],
      ["bht_entries", "entry_title = replace(entry_title, ' — synthetic training', '')", "entry_title LIKE '% — synthetic training'"],
      ["investigations", "reference_range = NULLIF(replace(reference_range, 'Illustrative training range: ', ''), 'Illustrative training reference')", "reference_range LIKE 'Illustrative training%'"],
      ["investigations", "reference_range = NULL", "reference_range = 'Synthetic illustration only'"],
      ["medication_orders", "instructions = NULL", "instructions LIKE 'Synthetic training instruction%'"],
      ["surgeries", "complications = 'None recorded'", "complications = 'None recorded in this synthetic scenario'"],
      ["medical_devices", "manufacturer = NULL", "manufacturer = 'Synthetic training manufacturer'"],
    ];
    for (const [table, assignment, condition] of updates) {
      const result = await client.query(
        `UPDATE public.${table} SET ${assignment} WHERE patient_id = ANY($1::bigint[]) AND ${condition}`,
        [patientIds],
      );
      if (result.rowCount) changes[`${table}.${assignment.split(" = ")[0]}`] = result.rowCount;
    }

    const codes = {
      opd_visits: "opd_number",
      clinic_visits: "visit_number",
      emergency_cases: "case_number",
      admissions: "admission_number",
      investigations: "report_reference",
      surgeries: "surgery_code",
      procedures: "procedure_code",
      medical_devices: "model_number",
    };
    for (const [table, column] of Object.entries(codes)) {
      await client.query(
        `UPDATE public.${table} SET ${column} = replace(${column}, '-TRN-', '-')
         WHERE patient_id = ANY($1::bigint[]) AND ${column} LIKE '%-TRN-%'`,
        [patientIds],
      );
    }
    await client.query(
      `UPDATE public.medical_devices SET serial_number = replace(serial_number, 'TRN-DEVICE-', 'DEVICE-')
       WHERE patient_id = ANY($1::bigint[]) AND serial_number LIKE 'TRN-DEVICE-%'`,
      [patientIds],
    );
    await client.query(
      `UPDATE public.emergency_case_locations SET notes = NULL
       WHERE emergency_case_id IN (SELECT emergency_case_id FROM public.emergency_cases WHERE patient_id = ANY($1::bigint[]))
         AND notes LIKE $2 || '%'`,
      [patientIds, PREFIX],
    );
    await client.query(
      `UPDATE public.hospital_users
       SET full_name = 'ECIS System', employee_number = 'SYS-IMPORT-001',
           username = 'ecis.system.import', department = 'Records Integration'
       WHERE user_id = $1`,
      [actor.rows[0].user_id],
    );

    const remaining = {};
    for (const table of Object.keys(PATIENT_TABLES)) {
      const result = await client.query(
        `SELECT count(*)::int AS n FROM public.${table} t
         WHERE t.patient_id = ANY($1::bigint[])
           AND to_jsonb(t)::text ~* $2`,
        [patientIds, ARTIFICIAL_WORDS],
      );
      if (result.rows[0].n) remaining[table] = result.rows[0].n;
    }
    if (Object.keys(remaining).length) {
      throw new Error(`Placeholder wording remains: ${JSON.stringify(remaining)}`);
    }
    await client.query("COMMIT");
    console.log(JSON.stringify({ normalizedPatients: patientIds.length, changedFields: changes }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
