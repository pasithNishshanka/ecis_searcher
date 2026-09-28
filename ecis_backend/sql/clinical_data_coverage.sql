BEGIN;

/*
 * One-time data-quality and coverage migration for the fictional ECIS
 * training database.  It writes only relational database records; no
 * frontend fallback or hard-coded display data is used.
 */

DO $migration_guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.admissions
    WHERE admission_number LIKE 'ADM-2025-%'
  ) THEN
    RAISE EXCEPTION
      'clinical_data_coverage.sql has already been applied; refusing to duplicate records.';
  END IF;
END
$migration_guard$;

/* The radiology API recognises IMAGING orders, not the older RADIOLOGY label. */
UPDATE public.investigations
SET
  investigation_type = 'IMAGING',
  updated_at = CURRENT_TIMESTAMP
WHERE investigation_type = 'RADIOLOGY';


/* Do not leave a bed marked occupied when it has no active admission. */
UPDATE public.beds b
SET
  status = 'AVAILABLE',
  updated_at = CURRENT_TIMESTAMP
WHERE
  b.status = 'OCCUPIED'
  AND NOT EXISTS (
    SELECT 1
    FROM public.admissions a
    WHERE
      a.bed_id = b.bed_id
      AND a.status = 'ADMITTED'
  );


/*
 * Repair older OPD records that point at an inpatient or clinic encounter.
 * Each OPD visit receives its own matching OPD encounter before reassignment.
 */
INSERT INTO public.encounters (
  patient_id,
  hospital_id,
  encounter_type,
  encounter_date,
  attending_user_id,
  department,
  status,
  chief_complaint,
  notes
)
SELECT
  o.patient_id,
  e.hospital_id,
  'OPD',
  o.visit_date,
  o.doctor_user_id,
  'Outpatient Department',
  'COMPLETED',
  o.chief_complaint,
  o.clinical_notes
FROM public.opd_visits o
JOIN public.encounters e
  ON e.encounter_id = o.encounter_id
WHERE e.encounter_type <> 'OPD';

UPDATE public.opd_visits o
SET encounter_id = (
  SELECT e2.encounter_id
  FROM public.encounters e2
  WHERE
    e2.patient_id = o.patient_id
    AND e2.encounter_type = 'OPD'
    AND e2.encounter_date = o.visit_date
  ORDER BY e2.encounter_id DESC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM public.encounters e
  WHERE
    e.encounter_id = o.encounter_id
    AND e.encounter_type <> 'OPD'
);


/* Keep treatments and their observations aligned to the repaired OPD visit. */
UPDATE public.treatment_records t
SET encounter_id = o.encounter_id
FROM public.opd_visits o
WHERE
  t.opd_visit_id = o.opd_visit_id
  AND t.encounter_id <> o.encounter_id;

UPDATE public.clinical_observations observation
SET encounter_id = treatment.encounter_id
FROM public.treatment_records treatment
WHERE
  observation.treatment_id = treatment.treatment_id
  AND observation.encounter_id <> treatment.encounter_id;


/* Repair older clinic visits that do not have a CLINIC encounter. */
INSERT INTO public.encounters (
  patient_id,
  hospital_id,
  encounter_type,
  encounter_date,
  attending_user_id,
  department,
  status,
  chief_complaint,
  notes
)
SELECT
  cv.patient_id,
  c.hospital_id,
  'CLINIC',
  cv.visit_date,
  cv.doctor_user_id,
  c.specialty,
  'COMPLETED',
  cv.reason_for_visit,
  cv.clinical_notes
FROM public.clinic_visits cv
JOIN public.encounters e
  ON e.encounter_id = cv.encounter_id
JOIN public.clinics c
  ON c.clinic_id = cv.clinic_id
WHERE e.encounter_type <> 'CLINIC';

UPDATE public.clinic_visits cv
SET encounter_id = (
  SELECT e2.encounter_id
  FROM public.encounters e2
  WHERE
    e2.patient_id = cv.patient_id
    AND e2.encounter_type = 'CLINIC'
    AND e2.encounter_date = cv.visit_date
  ORDER BY e2.encounter_id DESC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM public.encounters e
  WHERE
    e.encounter_id = cv.encounter_id
    AND e.encounter_type <> 'CLINIC'
);


/* Give every active patient a completed specialty clinic visit. */
WITH uncovered_patients AS (
  SELECT
    p.patient_id,
    p.hospital_id,
    CURRENT_TIMESTAMP -
      ((p.patient_id % 300) + 30) * INTERVAL '1 day' AS visit_date
  FROM public.patients p
  WHERE
    p.status = 'ACTIVE'
    AND NOT EXISTS (
      SELECT 1
      FROM public.clinic_visits cv
      WHERE cv.patient_id = p.patient_id
    )
), created_encounters AS (
  INSERT INTO public.encounters (
    patient_id,
    hospital_id,
    encounter_type,
    encounter_date,
    attending_user_id,
    department,
    status,
    chief_complaint,
    notes
  )
  SELECT
    up.patient_id,
    up.hospital_id,
    'CLINIC',
    up.visit_date,
    1,
    'Specialist Clinic',
    'COMPLETED',
    'Scheduled specialist follow-up',
    'Fictional longitudinal clinic record for training use.'
  FROM uncovered_patients up
  RETURNING
    encounter_id,
    patient_id,
    encounter_date
)
INSERT INTO public.clinic_visits (
  clinic_id,
  encounter_id,
  patient_id,
  visit_number,
  visit_date,
  doctor_user_id,
  reason_for_visit,
  clinical_notes,
  diagnosis_summary,
  follow_up_required,
  follow_up_date,
  status
)
SELECT
  (
    SELECT c.clinic_id
    FROM public.clinics c
    WHERE
      c.hospital_id = 1
      AND c.is_active = TRUE
    ORDER BY c.clinic_id
    OFFSET (ce.patient_id % 5)
    LIMIT 1
  ),
  ce.encounter_id,
  ce.patient_id,
  'CLN-2026-' || LPAD(ce.patient_id::text, 6, '0'),
  ce.encounter_date,
  1,
  'Scheduled specialist follow-up',
  'Symptoms reviewed; examination findings stable. Care plan and safety advice discussed.',
  CASE ce.patient_id % 4
    WHEN 0 THEN 'Essential hypertension under follow-up'
    WHEN 1 THEN 'Type 2 diabetes mellitus under follow-up'
    WHEN 2 THEN 'Osteoarthritis managed conservatively'
    ELSE 'Dyspepsia managed with lifestyle advice'
  END,
  (ce.patient_id % 3) = 0,
  CASE
    WHEN (ce.patient_id % 3) = 0
      THEN (ce.encounter_date::date + INTERVAL '90 days')::date
    ELSE NULL
  END,
  'COMPLETED'
FROM created_encounters ce;


/*
 * Extend inpatient coverage with completed admissions.  Historical records
 * reuse available beds only after discharge, which keeps bed state accurate.
 */
WITH candidates AS (
  SELECT
    p.patient_id,
    p.hospital_id,
    ROW_NUMBER() OVER (ORDER BY p.patient_number) AS row_number,
    CURRENT_TIMESTAMP -
      ((p.patient_id % 480) + 90) * INTERVAL '1 day' AS admission_date
  FROM public.patients p
  WHERE
    p.status = 'ACTIVE'
    AND NOT EXISTS (
      SELECT 1
      FROM public.admissions a
      WHERE a.patient_id = p.patient_id
    )
  ORDER BY p.patient_number
  LIMIT 700
), available_beds AS (
  SELECT
    b.bed_id,
    b.ward_id,
    ROW_NUMBER() OVER (ORDER BY b.bed_id) AS row_number
  FROM public.beds b
  WHERE b.status = 'AVAILABLE'
), bed_count AS (
  SELECT COUNT(*) AS total
  FROM available_beds
), created_encounters AS (
  INSERT INTO public.encounters (
    patient_id,
    hospital_id,
    encounter_type,
    encounter_date,
    attending_user_id,
    department,
    status,
    chief_complaint,
    notes
  )
  SELECT
    c.patient_id,
    c.hospital_id,
    'INPATIENT',
    c.admission_date,
    1,
    'Inpatient Care',
    'CLOSED',
    'Assessment and short inpatient observation',
    'Fictional historical inpatient record for training use.'
  FROM candidates c
  RETURNING
    encounter_id,
    patient_id
)
INSERT INTO public.admissions (
  patient_id,
  encounter_id,
  ward_id,
  bed_id,
  admission_number,
  admission_date,
  discharge_date,
  admission_reason,
  admission_diagnosis,
  discharge_diagnosis,
  discharge_summary,
  attending_doctor_id,
  status
)
SELECT
  c.patient_id,
  ce.encounter_id,
  b.ward_id,
  b.bed_id,
  'ADM-2025-' || LPAD(c.patient_id::text, 6, '0'),
  c.admission_date,
  c.admission_date + ((c.row_number % 4) + 2) * INTERVAL '1 day',
  CASE c.row_number % 4
    WHEN 0 THEN 'Observation after acute febrile illness'
    WHEN 1 THEN 'Short stay for blood pressure optimisation'
    WHEN 2 THEN 'Treatment of dehydration'
    ELSE 'Post-procedure observation'
  END,
  CASE c.row_number % 4
    WHEN 0 THEN 'Acute viral illness'
    WHEN 1 THEN 'Uncontrolled hypertension'
    WHEN 2 THEN 'Dehydration'
    ELSE 'Minor soft tissue injury'
  END,
  CASE c.row_number % 4
    WHEN 0 THEN 'Acute viral illness, improved'
    WHEN 1 THEN 'Blood pressure improved on treatment'
    WHEN 2 THEN 'Hydration restored'
    ELSE 'Pain controlled; wound care advice given'
  END,
  'Observed, treated, and discharged with documented follow-up advice.',
  1,
  'DISCHARGED'
FROM candidates c
JOIN created_encounters ce
  ON ce.patient_id = c.patient_id
CROSS JOIN bed_count bc
JOIN available_beds b
  ON b.row_number = ((c.row_number - 1) % bc.total) + 1;


/* Three complete BHT entries for each newly added historical admission. */
INSERT INTO public.bht_entries (
  admission_id,
  encounter_id,
  patient_id,
  hospital_id,
  entry_type,
  entry_date,
  entry_title,
  subjective_notes,
  objective_notes,
  assessment,
  plan,
  diagnosis,
  temperature_c,
  pulse_bpm,
  respiratory_rate_bpm,
  systolic_bp,
  diastolic_bp,
  spo2_percent,
  pain_score,
  weight_kg,
  recorded_by
)
SELECT
  a.admission_id,
  a.encounter_id,
  a.patient_id,
  e.hospital_id,
  entry.entry_type,
  a.admission_date + entry.day_offset * INTERVAL '1 day',
  entry.entry_title,
  entry.subjective_notes,
  entry.objective_notes,
  entry.assessment,
  entry.plan,
  a.admission_diagnosis,
  36.6 + ((a.patient_id % 4) * 0.1),
  72 + (a.patient_id % 14),
  16 + (a.patient_id % 3),
  112 + (a.patient_id % 18),
  70 + (a.patient_id % 12),
  97 + (a.patient_id % 3),
  a.patient_id % 4,
  p.weight_kg,
  1
FROM public.admissions a
JOIN public.encounters e
  ON e.encounter_id = a.encounter_id
JOIN public.patients p
  ON p.patient_id = a.patient_id
CROSS JOIN (
  VALUES
    (0, 'ADMISSION_ASSESSMENT', 'Admission assessment',
      'Patient admitted for assessment and observation.',
      'Initial observations stable; no immediate distress.',
      'Assessment completed and baseline care commenced.',
      'Monitor observations and review clinical response.'),
    (1, 'WARD_ROUND', 'Ward round review',
      'Patient reports improvement in symptoms.',
      'Observations remain stable on ward review.',
      'Clinical condition improving.',
      'Continue treatment and prepare discharge plan.'),
    (2, 'DISCHARGE_PLANNING', 'Discharge planning',
      'Patient feels well for discharge.',
      'Stable observations; discharge criteria met.',
      'Suitable for discharge with follow-up.',
      'Provide medication, return precautions, and follow-up advice.')
) AS entry(
  day_offset,
  entry_type,
  entry_title,
  subjective_notes,
  objective_notes,
  assessment,
  plan
)
WHERE
  a.admission_number LIKE 'ADM-2025-%'
  AND NOT EXISTS (
    SELECT 1
    FROM public.bht_entries existing_entry
    WHERE existing_entry.admission_id = a.admission_id
  );


/* Add twelve active admissions so ward and bed occupancy are represented. */
WITH candidates AS (
  SELECT
    p.patient_id,
    p.hospital_id,
    ROW_NUMBER() OVER (ORDER BY p.patient_number DESC) AS row_number
  FROM public.patients p
  WHERE
    p.status = 'ACTIVE'
    AND NOT EXISTS (
      SELECT 1
      FROM public.admissions a
      WHERE
        a.patient_id = p.patient_id
        AND a.status = 'ADMITTED'
    )
  ORDER BY p.patient_number DESC
  LIMIT 12
), available_beds AS (
  SELECT
    b.bed_id,
    b.ward_id,
    ROW_NUMBER() OVER (ORDER BY b.bed_id) AS row_number
  FROM public.beds b
  WHERE b.status = 'AVAILABLE'
  ORDER BY b.bed_id
  LIMIT 12
), created_encounters AS (
  INSERT INTO public.encounters (
    patient_id,
    hospital_id,
    encounter_type,
    encounter_date,
    attending_user_id,
    department,
    status,
    chief_complaint,
    notes
  )
  SELECT
    c.patient_id,
    c.hospital_id,
    'INPATIENT',
    CURRENT_TIMESTAMP - c.row_number * INTERVAL '1 day',
    1,
    'Inpatient Care',
    'OPEN',
    'Ongoing inpatient assessment',
    'Fictional active inpatient record for training use.'
  FROM candidates c
  RETURNING
    encounter_id,
    patient_id,
    encounter_date
), active_admissions AS (
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
  SELECT
    c.patient_id,
    ce.encounter_id,
    b.ward_id,
    b.bed_id,
    'ADM-2026-A' || LPAD(c.patient_id::text, 6, '0'),
    ce.encounter_date,
    'Ongoing clinical observation',
    CASE c.row_number % 3
      WHEN 0 THEN 'Acute asthma exacerbation'
      WHEN 1 THEN 'Community-acquired pneumonia'
      ELSE 'Acute gastroenteritis with dehydration'
    END,
    1,
    'ADMITTED'
  FROM candidates c
  JOIN created_encounters ce
    ON ce.patient_id = c.patient_id
  JOIN available_beds b
    ON b.row_number = c.row_number
  RETURNING
    admission_id,
    encounter_id,
    patient_id,
    bed_id,
    admission_date
), occupied_beds AS (
  UPDATE public.beds b
  SET
    status = 'OCCUPIED',
    updated_at = CURRENT_TIMESTAMP
  FROM active_admissions aa
  WHERE b.bed_id = aa.bed_id
  RETURNING b.bed_id
)
INSERT INTO public.bht_entries (
  admission_id,
  encounter_id,
  patient_id,
  hospital_id,
  entry_type,
  entry_date,
  entry_title,
  subjective_notes,
  objective_notes,
  assessment,
  plan,
  diagnosis,
  temperature_c,
  pulse_bpm,
  respiratory_rate_bpm,
  systolic_bp,
  diastolic_bp,
  spo2_percent,
  pain_score,
  weight_kg,
  recorded_by
)
SELECT
  aa.admission_id,
  aa.encounter_id,
  aa.patient_id,
  1,
  'ADMISSION_ASSESSMENT',
  aa.admission_date,
  'Current inpatient assessment',
  'Patient admitted for monitoring and treatment.',
  'Baseline observations recorded; treatment commenced.',
  'Requires ongoing inpatient review.',
  'Continue monitoring and review during ward round.',
  a.admission_diagnosis,
  37.0,
  88,
  18,
  124,
  78,
  97,
  3,
  p.weight_kg,
  1
FROM active_admissions aa
JOIN public.admissions a
  ON a.admission_id = aa.admission_id
JOIN public.patients p
  ON p.patient_id = aa.patient_id;


/*
 * The admission INSERT above is visible to this new statement.  This keeps
 * active-admission BHT entries linked even on PostgreSQL's single-statement
 * DML-CTE snapshot.
 */
INSERT INTO public.bht_entries (
  admission_id,
  encounter_id,
  patient_id,
  hospital_id,
  entry_type,
  entry_date,
  entry_title,
  subjective_notes,
  objective_notes,
  assessment,
  plan,
  diagnosis,
  temperature_c,
  pulse_bpm,
  respiratory_rate_bpm,
  systolic_bp,
  diastolic_bp,
  spo2_percent,
  pain_score,
  weight_kg,
  recorded_by
)
SELECT
  a.admission_id,
  a.encounter_id,
  a.patient_id,
  e.hospital_id,
  'ADMISSION_ASSESSMENT',
  a.admission_date,
  'Current inpatient assessment',
  'Patient admitted for monitoring and treatment.',
  'Baseline observations recorded; treatment commenced.',
  'Requires ongoing inpatient review.',
  'Continue monitoring and review during ward round.',
  a.admission_diagnosis,
  37.0,
  88,
  18,
  124,
  78,
  97,
  3,
  p.weight_kg,
  1
FROM public.admissions a
JOIN public.encounters e
  ON e.encounter_id = a.encounter_id
JOIN public.patients p
  ON p.patient_id = a.patient_id
WHERE
  a.status = 'ADMITTED'
  AND a.admission_number LIKE 'ADM-2026-A%'
  AND NOT EXISTS (
    SELECT 1
    FROM public.bht_entries existing_entry
    WHERE existing_entry.admission_id = a.admission_id
  );


/* Add a verified laboratory result for every patient without one. */
WITH candidates AS (
  SELECT
    p.patient_id,
    ROW_NUMBER() OVER (ORDER BY p.patient_number) AS row_number
  FROM public.patients p
  WHERE
    p.status = 'ACTIVE'
    AND NOT EXISTS (
      SELECT 1
      FROM public.investigations i
      WHERE
        i.patient_id = p.patient_id
        AND i.investigation_type IN ('LAB', 'LABORATORY')
    )
), encounter_map AS (
  SELECT
    c.patient_id,
    c.row_number,
    e.encounter_id,
    e.encounter_date
  FROM candidates c
  CROSS JOIN LATERAL (
    SELECT
      candidate_encounter.encounter_id,
      candidate_encounter.encounter_date
    FROM public.encounters candidate_encounter
    WHERE
      candidate_encounter.patient_id = c.patient_id
      AND candidate_encounter.encounter_type IN ('OPD', 'CLINIC', 'INPATIENT')
    ORDER BY candidate_encounter.encounter_date DESC, candidate_encounter.encounter_id DESC
    LIMIT 1
  ) e
)
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
SELECT
  em.patient_id,
  em.encounter_id,
  'LABORATORY',
  CASE em.row_number % 5
    WHEN 0 THEN 'Full Blood Count'
    WHEN 1 THEN 'Fasting Plasma Glucose'
    WHEN 2 THEN 'Serum Creatinine'
    WHEN 3 THEN 'Lipid Profile'
    ELSE 'Urine Full Report'
  END,
  em.encounter_date,
  em.encounter_date + INTERVAL '2 hours',
  CASE em.row_number % 5
    WHEN 0 THEN 'Haemoglobin and white-cell count within expected range.'
    WHEN 1 THEN 'Fasting glucose within the reference range.'
    WHEN 2 THEN 'Renal function within the reference range.'
    WHEN 3 THEN 'Lipid profile reviewed; lifestyle advice reinforced.'
    ELSE 'No significant abnormality detected on routine urine analysis.'
  END,
  CASE em.row_number % 5
    WHEN 0 THEN (12.8 + ((em.patient_id % 18) / 10.0))::text
    WHEN 1 THEN (82 + (em.patient_id % 18))::text
    WHEN 2 THEN (0.7 + ((em.patient_id % 5) / 10.0))::text
    WHEN 3 THEN (145 + (em.patient_id % 35))::text
    ELSE 'Negative'
  END,
  CASE em.row_number % 5
    WHEN 0 THEN 'g/dL'
    WHEN 1 THEN 'mg/dL'
    WHEN 2 THEN 'mg/dL'
    WHEN 3 THEN 'mg/dL'
    ELSE NULL
  END,
  CASE em.row_number % 5
    WHEN 0 THEN '12.0-16.0'
    WHEN 1 THEN '70-99'
    WHEN 2 THEN '0.6-1.2'
    WHEN 3 THEN 'Below 200'
    ELSE 'Negative'
  END,
  1,
  'LAB-2026-' || LPAD(em.patient_id::text, 6, '0'),
  'VERIFIED',
  1,
  1,
  em.encounter_date + INTERVAL '3 hours',
  'NORMAL',
  CASE em.row_number % 5
    WHEN 4 THEN 'Urine'
    ELSE 'Blood'
  END,
  'Routine fictional laboratory record for training use.'
FROM encounter_map em;


/*
 * Add reported and verified imaging orders for a wider patient sample.
 * No fabricated diagnostic image files are created: real image upload remains
 * a controlled user workflow.
 */
WITH candidates AS (
  SELECT
    p.patient_id,
    ROW_NUMBER() OVER (ORDER BY p.patient_number) AS row_number
  FROM public.patients p
  WHERE
    p.status = 'ACTIVE'
    AND NOT EXISTS (
      SELECT 1
      FROM public.investigations i
      WHERE
        i.patient_id = p.patient_id
        AND i.investigation_type = 'IMAGING'
    )
  ORDER BY p.patient_number
  LIMIT 800
), encounter_map AS (
  SELECT
    c.patient_id,
    c.row_number,
    e.encounter_id,
    e.encounter_date
  FROM candidates c
  CROSS JOIN LATERAL (
    SELECT
      candidate_encounter.encounter_id,
      candidate_encounter.encounter_date
    FROM public.encounters candidate_encounter
    WHERE
      candidate_encounter.patient_id = c.patient_id
      AND candidate_encounter.encounter_type IN ('OPD', 'CLINIC', 'INPATIENT')
    ORDER BY candidate_encounter.encounter_date DESC, candidate_encounter.encounter_id DESC
    LIMIT 1
  ) e
)
INSERT INTO public.investigations (
  patient_id,
  encounter_id,
  investigation_type,
  investigation_name,
  requested_date,
  performed_date,
  result_summary,
  body_site,
  performed_by,
  report_reference,
  status,
  requested_by,
  verified_by,
  verified_at,
  priority,
  clinical_notes
)
SELECT
  em.patient_id,
  em.encounter_id,
  'IMAGING',
  CASE em.row_number % 4
    WHEN 0 THEN 'Chest X-ray'
    WHEN 1 THEN 'Ultrasound abdomen'
    WHEN 2 THEN 'X-ray knee'
    ELSE 'CT brain'
  END,
  em.encounter_date,
  em.encounter_date + INTERVAL '4 hours',
  CASE em.row_number % 4
    WHEN 0 THEN 'No focal pulmonary consolidation or pleural effusion identified.'
    WHEN 1 THEN 'No acute abdominal abnormality identified on this examination.'
    WHEN 2 THEN 'No acute fracture seen; mild degenerative change noted.'
    ELSE 'No acute intracranial haemorrhage identified.'
  END,
  CASE em.row_number % 4
    WHEN 0 THEN 'Chest'
    WHEN 1 THEN 'Abdomen'
    WHEN 2 THEN 'Knee'
    ELSE 'Head'
  END,
  1,
  'IMG-2026-' || LPAD(em.patient_id::text, 6, '0'),
  'VERIFIED',
  1,
  1,
  em.encounter_date + INTERVAL '5 hours',
  'NORMAL',
  'Fictional imaging report for training use; no diagnostic image file is attached.'
FROM encounter_map em;


/* Add more completed surgeries using real inpatient admission links. */
WITH candidates AS (
  SELECT
    a.admission_id,
    a.encounter_id,
    a.patient_id,
    a.admission_date,
    ROW_NUMBER() OVER (ORDER BY a.patient_id) AS row_number
  FROM public.admissions a
  WHERE
    a.status = 'DISCHARGED'
    AND NOT EXISTS (
      SELECT 1
      FROM public.surgeries s
      WHERE s.patient_id = a.patient_id
    )
  ORDER BY a.patient_id
  LIMIT 300
)
INSERT INTO public.surgeries (
  patient_id,
  encounter_id,
  admission_id,
  surgery_code,
  surgery_name,
  surgery_date,
  body_site,
  laterality,
  surgeon_user_id,
  preoperative_diagnosis,
  postoperative_diagnosis,
  findings,
  complications,
  surgical_notes
)
SELECT
  c.patient_id,
  c.encounter_id,
  c.admission_id,
  'SX-2025-' || LPAD(c.patient_id::text, 6, '0'),
  CASE c.row_number % 3
    WHEN 0 THEN 'Open inguinal hernia repair'
    WHEN 1 THEN 'Laparoscopic cholecystectomy'
    ELSE 'Closed reduction and casting'
  END,
  c.admission_date + INTERVAL '1 day',
  CASE c.row_number % 3
    WHEN 0 THEN 'Groin'
    WHEN 1 THEN 'Abdomen'
    ELSE 'Forearm'
  END,
  CASE c.row_number % 3
    WHEN 2 THEN CASE WHEN c.patient_id % 2 = 0 THEN 'LEFT' ELSE 'RIGHT' END
    ELSE NULL
  END,
  1,
  CASE c.row_number % 3
    WHEN 0 THEN 'Symptomatic uncomplicated inguinal hernia'
    WHEN 1 THEN 'Symptomatic gallstone disease'
    ELSE 'Closed distal radius fracture'
  END,
  CASE c.row_number % 3
    WHEN 0 THEN 'Inguinal hernia repaired'
    WHEN 1 THEN 'Gallbladder removed without complication'
    ELSE 'Alignment satisfactory after reduction'
  END,
  'Procedure completed as planned with stable recovery.',
  'None recorded',
  'Fictional completed operative record for training use.'
FROM candidates c;


/* Add a broader set of completed procedures with valid patient encounters. */
WITH candidates AS (
  SELECT
    p.patient_id,
    ROW_NUMBER() OVER (ORDER BY p.patient_number) AS row_number
  FROM public.patients p
  WHERE
    p.status = 'ACTIVE'
    AND NOT EXISTS (
      SELECT 1
      FROM public.procedures pr
      WHERE pr.patient_id = p.patient_id
    )
  ORDER BY p.patient_number
  LIMIT 400
), encounter_map AS (
  SELECT
    c.patient_id,
    c.row_number,
    e.encounter_id,
    e.encounter_date
  FROM candidates c
  CROSS JOIN LATERAL (
    SELECT
      candidate_encounter.encounter_id,
      candidate_encounter.encounter_date
    FROM public.encounters candidate_encounter
    WHERE
      candidate_encounter.patient_id = c.patient_id
      AND candidate_encounter.encounter_type IN ('OPD', 'CLINIC', 'INPATIENT')
    ORDER BY candidate_encounter.encounter_date DESC, candidate_encounter.encounter_id DESC
    LIMIT 1
  ) e
)
INSERT INTO public.procedures (
  patient_id,
  encounter_id,
  procedure_code,
  procedure_name,
  procedure_date,
  body_site,
  laterality,
  performed_by,
  indication,
  findings,
  outcome
)
SELECT
  em.patient_id,
  em.encounter_id,
  'PR-2026-' || LPAD(em.patient_id::text, 6, '0'),
  CASE em.row_number % 4
    WHEN 0 THEN 'Wound dressing'
    WHEN 1 THEN 'Nebulisation therapy'
    WHEN 2 THEN 'Electrocardiogram'
    ELSE 'Simple wound suturing'
  END,
  em.encounter_date,
  CASE em.row_number % 4
    WHEN 0 THEN 'Skin'
    WHEN 1 THEN 'Respiratory tract'
    WHEN 2 THEN 'Chest'
    ELSE 'Upper limb'
  END,
  CASE em.row_number % 4
    WHEN 3 THEN CASE WHEN em.patient_id % 2 = 0 THEN 'LEFT' ELSE 'RIGHT' END
    ELSE NULL
  END,
  1,
  CASE em.row_number % 4
    WHEN 0 THEN 'Minor wound care'
    WHEN 1 THEN 'Wheeze requiring bronchodilator treatment'
    WHEN 2 THEN 'Cardiovascular assessment'
    ELSE 'Simple laceration requiring closure'
  END,
  CASE em.row_number % 4
    WHEN 0 THEN 'Wound clean with no clinical sign of infection'
    WHEN 1 THEN 'Breath sounds improved after therapy'
    WHEN 2 THEN 'No acute ECG abnormality identified'
    ELSE 'Wound edges approximated satisfactorily'
  END,
  'Completed without complication; follow-up advice provided.'
FROM encounter_map em;


COMMIT;
