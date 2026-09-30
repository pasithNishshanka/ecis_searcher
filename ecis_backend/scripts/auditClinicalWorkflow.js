const pool = require("../src/config/database");

const countTables = [
  "patients", "encounters", "opd_visits", "clinic_visits", "emergency_cases",
  "admissions", "bht_entries", "investigations", "radiology_images",
  "medication_orders", "medication_dispensations", "surgeries", "procedures",
  "fractures", "dental_records", "medical_devices", "treatment_records",
];

async function main() {
  const counts = Object.fromEntries(await Promise.all(countTables.map(async (table) => {
    const result = await pool.query(`SELECT count(*)::int AS count FROM public.${table};`);
    return [table, result.rows[0].count];
  })));

  const integrity = await pool.query(`
    SELECT
      count(*) FILTER (WHERE a.status = 'ADMITTED')::int AS active_admissions,
      count(*) FILTER (WHERE a.status = 'ADMITTED' AND a.attending_doctor_id IS NULL)::int AS active_without_doctor,
      count(*) FILTER (WHERE a.status = 'ADMITTED' AND b.status IS DISTINCT FROM 'OCCUPIED')::int AS active_bed_not_occupied,
      count(*) FILTER (WHERE a.status = 'ADMITTED' AND e.status IS DISTINCT FROM 'OPEN' AND e.status IS DISTINCT FROM 'ADMITTED')::int AS active_encounter_invalid_status,
      count(*) FILTER (WHERE a.status = 'DISCHARGED' AND e.status IS DISTINCT FROM 'COMPLETED')::int AS discharged_encounter_not_completed,
      count(*) FILTER (WHERE a.status = 'ADMITTED' AND NOT EXISTS (
        SELECT 1 FROM public.bht_entries entry WHERE entry.admission_id = a.admission_id
      ))::int AS active_without_bht
    FROM public.admissions a
    LEFT JOIN public.beds b ON b.bed_id = a.bed_id
    LEFT JOIN public.encounters e ON e.encounter_id = a.encounter_id;
  `);

  const duplicates = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM (
        SELECT patient_id FROM public.admissions WHERE status = 'ADMITTED'
        GROUP BY patient_id HAVING count(*) > 1
      ) rows) AS patients_with_multiple_active_admissions,
      (SELECT count(*)::int FROM (
        SELECT bed_id FROM public.admissions WHERE status = 'ADMITTED'
        GROUP BY bed_id HAVING count(*) > 1
      ) rows) AS beds_with_multiple_active_admissions;
  `);

  const hospitals = await pool.query(`
    SELECT h.hospital_id, h.hospital_name,
      (SELECT count(*)::int FROM public.patient_hospital_registrations phr
        WHERE phr.hospital_id = h.hospital_id AND phr.status = 'ACTIVE') AS registered_patients,
      (SELECT count(*)::int FROM public.hospital_user_assignments assignment
        JOIN public.hospital_users staff ON staff.user_id = assignment.user_id
        WHERE assignment.hospital_id = h.hospital_id AND assignment.role = 'DOCTOR'
          AND assignment.status = 'ACTIVE' AND staff.is_active = TRUE
          AND assignment.start_date <= CURRENT_DATE
          AND (assignment.end_date IS NULL OR assignment.end_date >= CURRENT_DATE)) AS active_doctors
    FROM public.hospitals h WHERE h.is_active = TRUE ORDER BY h.hospital_id;
  `);

  const admissionIntegrity = { ...integrity.rows[0], ...duplicates.rows[0] };
  const hardChecks = [
    "active_bed_not_occupied", "active_encounter_invalid_status",
    "discharged_encounter_not_completed", "patients_with_multiple_active_admissions",
    "beds_with_multiple_active_admissions",
  ];
  const failures = hardChecks.filter((key) => admissionIntegrity[key] > 0);
  const warnings = [];
  if (admissionIntegrity.active_without_doctor > 0) warnings.push("Some active admissions have no attending doctor linked.");
  if (admissionIntegrity.active_without_bht > 0) warnings.push("Some active admissions have no BHT entry.");
  if (counts.radiology_images === 0) warnings.push("No radiology images are stored, although imaging investigations may exist.");
  if (counts.medication_dispensations === 0) warnings.push("No medication dispensations are recorded.");
  for (const hospital of hospitals.rows) {
    if (hospital.registered_patients > 0 && hospital.active_doctors === 0) {
      warnings.push(`Hospital ${hospital.hospital_id} has registered patients but no active doctor assignment.`);
    }
  }

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    recordCounts: counts,
    admissionIntegrity,
    hospitalCoverage: hospitals.rows,
    warnings,
    failures,
  }, null, 2));
  if (failures.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => { console.error(`Workflow audit failed: ${error.message}`); process.exitCode = 1; })
  .finally(() => pool.end());
