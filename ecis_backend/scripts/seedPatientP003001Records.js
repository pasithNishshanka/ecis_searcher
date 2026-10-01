// A deliberately scoped local-data fixture for the fictional patient P003001.
// Clinical events are synthetic and are never attributed to a real clinician.
const pool = require("../src/config/database");

const PATIENT_NUMBER = "P003001";
const FIXTURE_ACTION = "SYNTHETIC_PATIENT_HISTORY_ADDED";

function assertLocalDatabase() {
  if (process.env.NODE_ENV === "production" ||
      !["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST) ||
      process.env.DB_NAME !== "ecis_ehr") {
    throw new Error("This fixture is restricted to the local ecis_ehr development database.");
  }
}

async function addEncounter(client, patientId, hospitalId, details) {
  const result = await client.query(`
    INSERT INTO public.encounters
      (patient_id, hospital_id, encounter_type, encounter_date, department, status, chief_complaint, notes)
    VALUES ($1, $2, $3, $4, $5, 'COMPLETED', $6, $7)
    RETURNING encounter_id;
  `, [patientId, hospitalId, details.type, details.date, details.department, details.complaint, details.notes]);
  return result.rows[0].encounter_id;
}

async function addTreatment(client, patientId, encounterId, date, type, name, description, links = {}) {
  await client.query(`
    INSERT INTO public.treatment_records
      (patient_id, encounter_id, opd_visit_id, clinic_visit_id, treatment_date,
       treatment_type, treatment_name, description, outcome)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
  `, [patientId, encounterId, links.opdVisitId || null, links.clinicVisitId || null,
    date, type, name, description, "Follow-up plan recorded"]);
}

async function addObservation(client, patientId, encounterId, date, type, value) {
  await client.query(`
    INSERT INTO public.clinical_observations
      (patient_id, encounter_id, observation_type, observation_value, observed_date)
    VALUES ($1, $2, $3, $4, $5);
  `, [patientId, encounterId, type, value, date]);
}

async function main() {
  assertLocalDatabase();
  const apply = process.argv.includes("--apply");
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    if (apply) {
      await client.query("BEGIN");
      transactionOpen = true;
      await client.query("SELECT pg_advisory_xact_lock(3001, 15199);");
    }
    const patientResult = await client.query(`
      SELECT p.patient_id, p.patient_number, p.first_name, p.last_name, p.hospital_id
      FROM public.patients p
      WHERE p.patient_number = $1;
    `, [PATIENT_NUMBER]);
    if (patientResult.rowCount !== 1) throw new Error("Expected exactly one P003001 patient.");
    const patient = patientResult.rows[0];
    if (patient.first_name !== "Lord" || patient.last_name !== "Voldermort" ||
        Number(patient.hospital_id) !== 1) {
      throw new Error("P003001 no longer matches the expected fictional local patient.");
    }
    const patientId = Number(patient.patient_id);
    const hospitalId = Number(patient.hospital_id);
    const registration = await client.query(`
      SELECT 1 FROM public.patient_hospital_registrations
      WHERE patient_id = $1 AND hospital_id = $2 AND status = 'ACTIVE';
    `, [patientId, hospitalId]);
    if (!registration.rowCount) throw new Error("P003001 is not actively registered at hospital 1.");
    const seeded = await client.query(`
      SELECT 1 FROM public.audit_logs
      WHERE hospital_id = $1 AND entity_type = 'patient' AND entity_id = $2
        AND action_type = $3 LIMIT 1;
    `, [hospitalId, patientId, FIXTURE_ACTION]);
    if (seeded.rowCount) {
      if (transactionOpen) {
        await client.query("ROLLBACK");
        transactionOpen = false;
      }
      console.log(JSON.stringify({ patientNumber: PATIENT_NUMBER, alreadySeeded: true }));
      return;
    }
    const existing = await client.query(`
      SELECT
        (SELECT count(*)::int FROM public.encounters WHERE patient_id = $1) AS encounters,
        (SELECT count(*)::int FROM public.dental_records WHERE patient_id = $1) AS dental,
        (SELECT count(*)::int FROM public.investigations WHERE patient_id = $1) AS investigations,
        (SELECT count(*)::int FROM public.medication_orders WHERE patient_id = $1) AS medications,
        (SELECT count(*)::int FROM public.patient_conditions WHERE patient_id = $1) AS conditions;
    `, [patientId]);
    if (Object.values(existing.rows[0]).some((count) => count > 0)) {
      throw new Error("P003001 already has clinical records; refusing to mix or duplicate histories.");
    }
    const clinic = await client.query(`
      SELECT clinic_id FROM public.clinics
      WHERE hospital_id = $1 AND clinic_code = 'ORTH-C01' AND is_active = TRUE;
    `, [hospitalId]);
    if (clinic.rowCount !== 1) throw new Error("The orthopedic clinic is not available at hospital 1.");
    const actor = await client.query(`
      SELECT user_id FROM public.hospital_users
      WHERE hospital_id = $1 AND employee_number = 'SYS-IMPORT-001'
        AND role = 'DATASET_GENERATOR' AND is_active = TRUE;
    `, [hospitalId]);
    if (actor.rowCount !== 1) throw new Error("The local dataset-import actor is unavailable.");
    if (!apply) {
      console.log(JSON.stringify({ patientNumber: PATIENT_NUMBER, patientId,
        planned: { encounters: 3, opdVisits: 1, clinicVisits: 1, dentalRecords: 1,
          labResults: 2, observations: 5, treatmentSummaries: 3 },
        message: "Read-only preview. Run with --apply to insert this local synthetic history." }, null, 2));
      return;
    }

    const opdDate = "2026-02-12 09:20:00";
    const opdEncounter = await addEncounter(client, patientId, hospitalId, {
      type: "OPD", date: opdDate, department: "Outpatient Department",
      complaint: "Gradual bilateral knee pain and stiffness on walking",
      notes: "No recent fall reported. Symptoms have increased over several months.",
    });
    const opd = await client.query(`
      INSERT INTO public.opd_visits
        (encounter_id, patient_id, opd_number, visit_date, chief_complaint, clinical_notes,
         diagnosis_summary, follow_up_required, follow_up_date, status)
      VALUES ($1, $2, 'OPD-P003001-20260212', $3, $4, $5, $6, TRUE, '2026-03-19', 'COMPLETED')
      RETURNING opd_visit_id;
    `, [opdEncounter, patientId, opdDate,
      "Bilateral knee pain and morning stiffness",
      "Mobilising independently. No injury, fever, or joint redness recorded.",
      "Probable age-related knee osteoarthritis; orthopedic follow-up arranged."]);
    await addObservation(client, patientId, opdEncounter, opdDate, "BLOOD_PRESSURE", "142/82 mmHg");
    await addObservation(client, patientId, opdEncounter, opdDate, "PULSE", "78 bpm");
    await addObservation(client, patientId, opdEncounter, opdDate, "TEMPERATURE", "36.7 °C");
    await addTreatment(client, patientId, opdEncounter, opdDate, "OPD", "Conservative knee care advice",
      "Discussed activity pacing and arranged orthopedic review. No medicine or procedure is recorded as supplied.",
      { opdVisitId: opd.rows[0].opd_visit_id });
    for (const lab of [
      { name: "Haemoglobin", value: "13.0", unit: "g/dL", range: "13.0-17.0",
        summary: "Haemoglobin at the lower end of the adult male reference range." },
      { name: "Serum creatinine", value: "1.02", unit: "mg/dL", range: "0.70-1.30",
        summary: "Creatinine within the stated laboratory reference range." },
    ]) {
      await client.query(`
        INSERT INTO public.investigations
          (patient_id, encounter_id, investigation_type, investigation_name,
           requested_date, performed_date, result_summary, result_value, unit,
           reference_range, status, priority, specimen_type)
        VALUES ($1, $2, 'LAB', $3, $4, $5, $6, $7, $8, $9, 'RESULTED', 'ROUTINE', 'Blood');
      `, [patientId, opdEncounter, lab.name, opdDate, "2026-02-12 11:30:00",
        lab.summary, lab.value, lab.unit, lab.range]);
    }

    const clinicDate = "2026-03-19 10:10:00";
    const clinicEncounter = await addEncounter(client, patientId, hospitalId, {
      type: "CLINIC", date: clinicDate, department: "Orthopedic Clinic",
      complaint: "Review of bilateral knee pain",
      notes: "Follow-up after outpatient assessment.",
    });
    const visit = await client.query(`
      INSERT INTO public.clinic_visits
        (clinic_id, encounter_id, patient_id, visit_number, visit_date, reason_for_visit,
         clinical_notes, diagnosis_summary, follow_up_required, follow_up_date, status)
      VALUES ($1, $2, $3, 'ORTH-P003001-20260319', $4, $5, $6, $7, TRUE, '2026-06-18', 'COMPLETED')
      RETURNING clinic_visit_id;
    `, [clinic.rows[0].clinic_id, clinicEncounter, patientId, clinicDate,
      "Review of persistent knee discomfort",
      "Pain is less frequent with activity pacing; no new injury reported.",
      "Bilateral knee osteoarthritis, managed conservatively."]);
    await addObservation(client, patientId, clinicEncounter, clinicDate, "BLOOD_PRESSURE", "136/80 mmHg");
    await addObservation(client, patientId, clinicEncounter, clinicDate, "PULSE", "74 bpm");
    await addTreatment(client, patientId, clinicEncounter, clinicDate, "CLINIC", "Mobility and exercise plan",
      "Home range-of-motion exercises reviewed; follow-up advised if pain or mobility worsens.",
      { clinicVisitId: visit.rows[0].clinic_visit_id });

    const dentalDate = "2026-06-10 14:00:00";
    const dentalEncounter = await addEncounter(client, patientId, hospitalId, {
      type: "DENTAL", date: dentalDate, department: "Dental Clinic",
      complaint: "Intermittent sensitivity of lower left molar",
      notes: "Dental assessment visit; no extraction or restoration performed.",
    });
    await client.query(`
      INSERT INTO public.dental_records
        (patient_id, encounter_id, record_date, tooth_number, condition, treatment,
         crown_present, implant_present, missing_tooth, notes)
      VALUES ($1, $2, '2026-06-10', '36', 'Occlusal caries',
        'Examination and restoration planning', FALSE, FALSE, FALSE, $3);
    `, [patientId, dentalEncounter,
      "Sensitivity to cold reported. Definitive restorative treatment was not recorded at this visit."]);
    await addTreatment(client, patientId, dentalEncounter, dentalDate, "DENTAL", "Dental assessment",
      "Tooth 36 assessed. Restoration discussed; no invasive treatment recorded.");

    await client.query(`
      INSERT INTO public.audit_logs
        (hospital_id, user_id, action_type, entity_type, entity_id, new_values, action_reason)
      VALUES ($1, $2, $3, 'patient', $4, $5::jsonb,
        'User-requested synthetic local test history; not evidence of real clinical care.');
    `, [hospitalId, actor.rows[0].user_id, FIXTURE_ACTION, patientId,
      JSON.stringify({ patientNumber: PATIENT_NUMBER,
        encounterIds: [opdEncounter, clinicEncounter, dentalEncounter],
        origin: "local synthetic fixture" })]);
    await client.query("COMMIT");
    transactionOpen = false;
    console.log(JSON.stringify({ patientNumber: PATIENT_NUMBER, patientId,
      encounterIds: [opdEncounter, clinicEncounter, dentalEncounter],
      inserted: { encounters: 3, opdVisits: 1, clinicVisits: 1, dentalRecords: 1,
        labResults: 2, observations: 5, treatmentSummaries: 3 } }, null, 2));
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => pool.end());
