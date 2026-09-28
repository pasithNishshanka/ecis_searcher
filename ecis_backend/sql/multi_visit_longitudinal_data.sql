BEGIN;

/*
 * One-time longitudinal-data migration for the fictional ECIS training
 * database. It creates repeat visits only as linked clinical rows in
 * PostgreSQL; it does not add static frontend records.
 */

DO $migration_guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.opd_visits
    WHERE opd_number LIKE 'OPD-FU-2026-%'
  ) THEN
    RAISE EXCEPTION
      'multi_visit_longitudinal_data.sql has already been applied; refusing to duplicate records.';
  END IF;
END
$migration_guard$;


/*
 * 500 patients receive three chronologically ordered OPD follow-up visits.
 * Every visit has its own encounter, visit, treatment and observation.
 */
WITH selected_patients AS (
  SELECT
    p.patient_id,
    p.hospital_id,
    CAST(SUBSTRING(p.patient_number FROM 2) AS INTEGER) AS patient_serial,
    ROW_NUMBER() OVER (
      ORDER BY
        (CAST(SUBSTRING(p.patient_number FROM 2) AS INTEGER) * 37) % 2003,
        p.patient_number
    ) AS patient_rank
  FROM public.patients p
  WHERE p.status = 'ACTIVE'
  ORDER BY
    (CAST(SUBSTRING(p.patient_number FROM 2) AS INTEGER) * 37) % 2003,
    p.patient_number
  LIMIT 500
), follow_up_visits AS (
  SELECT
    sp.patient_id,
    sp.hospital_id,
    sp.patient_serial,
    sequence.visit_index,
    CURRENT_TIMESTAMP - (
      (sp.patient_serial % 120) +
      ((4 - sequence.visit_index) * 90)
    ) * INTERVAL '1 day' AS visit_date,
    (sp.patient_serial + sequence.visit_index) % 4 AS pathway
  FROM selected_patients sp
  CROSS JOIN (
    VALUES (1), (2), (3)
  ) AS sequence(visit_index)
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
    fv.patient_id,
    fv.hospital_id,
    'OPD',
    fv.visit_date,
    1,
    'Outpatient Department',
    'COMPLETED',
    CASE fv.pathway
      WHEN 0 THEN 'Blood pressure follow-up'
      WHEN 1 THEN 'Diabetes follow-up'
      WHEN 2 THEN 'Asthma control review'
      ELSE 'Knee pain and mobility follow-up'
    END,
    'Fictional longitudinal outpatient follow-up for training use.'
  FROM follow_up_visits fv
  RETURNING
    encounter_id,
    patient_id,
    encounter_date
), created_opd_visits AS (
  INSERT INTO public.opd_visits (
    encounter_id,
    patient_id,
    opd_number,
    visit_date,
    doctor_user_id,
    chief_complaint,
    clinical_notes,
    diagnosis_summary,
    follow_up_required,
    follow_up_date,
    status
  )
  SELECT
    ce.encounter_id,
    fv.patient_id,
    'OPD-FU-2026-' ||
      LPAD(fv.patient_serial::text, 6, '0') ||
      '-' || fv.visit_index,
    fv.visit_date,
    1,
    CASE fv.pathway
      WHEN 0 THEN 'Blood pressure follow-up'
      WHEN 1 THEN 'Diabetes follow-up'
      WHEN 2 THEN 'Asthma control review'
      ELSE 'Knee pain and mobility follow-up'
    END,
    CASE fv.pathway
      WHEN 0 THEN 'Home readings reviewed. Diet, activity and adherence discussed.'
      WHEN 1 THEN 'Dietary pattern and self-monitoring reviewed. No hypoglycaemic symptoms reported.'
      WHEN 2 THEN 'Inhaler technique reviewed. No urgent respiratory symptoms reported.'
      ELSE 'Activity tolerance reviewed. Exercise and joint-protection advice reinforced.'
    END,
    CASE fv.pathway
      WHEN 0 THEN 'Essential hypertension under follow-up'
      WHEN 1 THEN 'Type 2 diabetes mellitus under follow-up'
      WHEN 2 THEN 'Asthma under follow-up'
      ELSE 'Knee osteoarthritis managed conservatively'
    END,
    fv.visit_index < 3,
    CASE
      WHEN fv.visit_index < 3
        THEN (fv.visit_date::date + INTERVAL '90 days')::date
      ELSE NULL
    END,
    'COMPLETED'
  FROM follow_up_visits fv
  JOIN created_encounters ce
    ON ce.patient_id = fv.patient_id
    AND ce.encounter_date = fv.visit_date
  RETURNING
    opd_visit_id,
    encounter_id,
    patient_id
), created_treatments AS (
  INSERT INTO public.treatment_records (
    patient_id,
    encounter_id,
    opd_visit_id,
    treatment_date,
    treatment_type,
    treatment_name,
    description,
    body_site,
    performed_by,
    outcome,
    complications
  )
  SELECT
    fv.patient_id,
    cov.encounter_id,
    cov.opd_visit_id,
    fv.visit_date,
    'OUTPATIENT_FOLLOW_UP',
    CASE fv.pathway
      WHEN 0 THEN 'Blood pressure counselling and medication review'
      WHEN 1 THEN 'Diabetes self-management education'
      WHEN 2 THEN 'Inhaler technique counselling'
      ELSE 'Exercise and joint-protection advice'
    END,
    CASE fv.pathway
      WHEN 0 THEN 'Lifestyle measures, adherence and cardiovascular risk reduction reviewed.'
      WHEN 1 THEN 'Nutrition, activity, glucose monitoring and foot-care advice reinforced.'
      WHEN 2 THEN 'Spacer use, trigger avoidance and reliever plan reviewed.'
      ELSE 'Home exercise, pacing and safe analgesia advice provided.'
    END,
    CASE fv.pathway
      WHEN 2 THEN 'Respiratory tract'
      WHEN 3 THEN 'Knee'
      ELSE NULL
    END,
    1,
    CASE
      WHEN fv.visit_index = 3 THEN 'Follow-up course completed; routine review as needed.'
      ELSE 'Plan understood; follow-up appointment arranged.'
    END,
    'None recorded'
  FROM follow_up_visits fv
  JOIN created_opd_visits cov
    ON cov.patient_id = fv.patient_id
  JOIN created_encounters ce
    ON ce.encounter_id = cov.encounter_id
    AND ce.encounter_date = fv.visit_date
  RETURNING
    treatment_id,
    encounter_id,
    patient_id
)
INSERT INTO public.clinical_observations (
  patient_id,
  encounter_id,
  treatment_id,
  observation_type,
  observation_value,
  body_site,
  observed_date,
  recorded_by,
  notes
)
SELECT
  fv.patient_id,
  ct.encounter_id,
  ct.treatment_id,
  CASE fv.pathway
    WHEN 0 THEN 'Blood pressure'
    WHEN 1 THEN 'Capillary blood glucose'
    WHEN 2 THEN 'Peak expiratory flow'
    ELSE 'Pain score'
  END,
  CASE fv.pathway
    WHEN 0 THEN (122 + ((fv.patient_serial + fv.visit_index) % 14))::text || '/' ||
      (76 + ((fv.patient_serial + fv.visit_index) % 8))::text || ' mmHg'
    WHEN 1 THEN (88 + ((fv.patient_serial + fv.visit_index) % 25))::text || ' mg/dL'
    WHEN 2 THEN (390 + ((fv.patient_serial + fv.visit_index) % 80))::text || ' L/min'
    ELSE (2 + ((fv.patient_serial + fv.visit_index) % 4))::text || '/10'
  END,
  CASE fv.pathway
    WHEN 2 THEN 'Chest'
    WHEN 3 THEN 'Knee'
    ELSE NULL
  END,
  fv.visit_date,
  1,
  'Fictional follow-up observation for training use.'
FROM follow_up_visits fv
JOIN created_treatments ct
  ON ct.patient_id = fv.patient_id
JOIN created_encounters ce
  ON ce.encounter_id = ct.encounter_id
  AND ce.encounter_date = fv.visit_date;


/*
 * 300 of the same patients receive two specialist clinic follow-ups. The
 * second visit includes a verified follow-up laboratory result.
 */
WITH selected_patients AS (
  SELECT
    p.patient_id,
    p.hospital_id,
    CAST(SUBSTRING(p.patient_number FROM 2) AS INTEGER) AS patient_serial
  FROM public.patients p
  WHERE p.status = 'ACTIVE'
  ORDER BY
    (CAST(SUBSTRING(p.patient_number FROM 2) AS INTEGER) * 37) % 2003,
    p.patient_number
  LIMIT 300
), follow_up_visits AS (
  SELECT
    sp.patient_id,
    sp.hospital_id,
    sp.patient_serial,
    sequence.visit_index,
    CURRENT_TIMESTAMP - (
      (sp.patient_serial % 100) +
      ((3 - sequence.visit_index) * 120)
    ) * INTERVAL '1 day' AS visit_date,
    (sp.patient_serial + sequence.visit_index) % 3 AS pathway
  FROM selected_patients sp
  CROSS JOIN (
    VALUES (1), (2)
  ) AS sequence(visit_index)
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
    fv.patient_id,
    fv.hospital_id,
    'CLINIC',
    fv.visit_date,
    1,
    'General Medicine Clinic',
    'COMPLETED',
    CASE fv.pathway
      WHEN 0 THEN 'Hypertension clinic follow-up'
      WHEN 1 THEN 'Diabetes clinic follow-up'
      ELSE 'Respiratory clinic follow-up'
    END,
    'Fictional longitudinal specialist clinic follow-up for training use.'
  FROM follow_up_visits fv
  RETURNING
    encounter_id,
    patient_id,
    encounter_date
), created_clinic_visits AS (
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
    13,
    ce.encounter_id,
    fv.patient_id,
    'CLN-FU-2026-' ||
      LPAD(fv.patient_serial::text, 6, '0') ||
      '-' || fv.visit_index,
    fv.visit_date,
    1,
    CASE fv.pathway
      WHEN 0 THEN 'Hypertension clinic follow-up'
      WHEN 1 THEN 'Diabetes clinic follow-up'
      ELSE 'Respiratory clinic follow-up'
    END,
    'Symptoms, adherence and self-management plan reviewed. No urgent concerns identified.',
    CASE fv.pathway
      WHEN 0 THEN 'Essential hypertension under follow-up'
      WHEN 1 THEN 'Type 2 diabetes mellitus under follow-up'
      ELSE 'Asthma under follow-up'
    END,
    fv.visit_index = 1,
    CASE
      WHEN fv.visit_index = 1
        THEN (fv.visit_date::date + INTERVAL '120 days')::date
      ELSE NULL
    END,
    'COMPLETED'
  FROM follow_up_visits fv
  JOIN created_encounters ce
    ON ce.patient_id = fv.patient_id
    AND ce.encounter_date = fv.visit_date
  RETURNING
    clinic_visit_id,
    encounter_id,
    patient_id
), created_treatments AS (
  INSERT INTO public.treatment_records (
    patient_id,
    encounter_id,
    clinic_visit_id,
    treatment_date,
    treatment_type,
    treatment_name,
    description,
    performed_by,
    outcome,
    complications
  )
  SELECT
    fv.patient_id,
    ccv.encounter_id,
    ccv.clinic_visit_id,
    fv.visit_date,
    'CLINIC_FOLLOW_UP',
    CASE fv.pathway
      WHEN 0 THEN 'Cardiovascular risk counselling'
      WHEN 1 THEN 'Diabetes care-plan review'
      ELSE 'Asthma action-plan review'
    END,
    CASE fv.pathway
      WHEN 0 THEN 'Blood pressure trend and cardiovascular risk factors reviewed.'
      WHEN 1 THEN 'Diet, glucose trends and complication prevention discussed.'
      ELSE 'Trigger avoidance and reliever escalation plan reviewed.'
    END,
    1,
    CASE
      WHEN fv.visit_index = 2 THEN 'Specialist follow-up completed; continue routine monitoring.'
      ELSE 'Patient stable; return visit arranged.'
    END,
    'None recorded'
  FROM follow_up_visits fv
  JOIN created_clinic_visits ccv
    ON ccv.patient_id = fv.patient_id
  JOIN created_encounters ce
    ON ce.encounter_id = ccv.encounter_id
    AND ce.encounter_date = fv.visit_date
  RETURNING
    treatment_id,
    encounter_id,
    patient_id
), created_laboratory_results AS (
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
    fv.patient_id,
    ccv.encounter_id,
    'LABORATORY',
    CASE fv.pathway
      WHEN 0 THEN 'Serum creatinine'
      WHEN 1 THEN 'HbA1c'
      ELSE 'Peak flow assessment'
    END,
    fv.visit_date,
    fv.visit_date + INTERVAL '2 hours',
    CASE fv.pathway
      WHEN 0 THEN 'Renal function remains within the reference range.'
      WHEN 1 THEN 'Glycaemic control reviewed with follow-up advice provided.'
      ELSE 'Peak flow is consistent with stable outpatient control.'
    END,
    CASE fv.pathway
      WHEN 0 THEN (0.7 + ((fv.patient_serial % 5) / 10.0))::text
      WHEN 1 THEN (6.2 + ((fv.patient_serial % 8) / 10.0))::text
      ELSE (390 + (fv.patient_serial % 80))::text
    END,
    CASE fv.pathway
      WHEN 0 THEN 'mg/dL'
      WHEN 1 THEN '%'
      ELSE 'L/min'
    END,
    CASE fv.pathway
      WHEN 0 THEN '0.6-1.2'
      WHEN 1 THEN 'Below 7.0'
      ELSE 'Individualised'
    END,
    1,
    'LAB-FU-2026-' || LPAD(fv.patient_serial::text, 6, '0'),
    'VERIFIED',
    1,
    1,
    fv.visit_date + INTERVAL '3 hours',
    'NORMAL',
    'Blood',
    'Fictional clinic follow-up laboratory result for training use.'
  FROM follow_up_visits fv
  JOIN created_clinic_visits ccv
    ON ccv.patient_id = fv.patient_id
  JOIN created_encounters ce
    ON ce.encounter_id = ccv.encounter_id
    AND ce.encounter_date = fv.visit_date
  WHERE fv.visit_index = 2
  RETURNING investigation_id
)
INSERT INTO public.clinical_observations (
  patient_id,
  encounter_id,
  treatment_id,
  observation_type,
  observation_value,
  observed_date,
  recorded_by,
  notes
)
SELECT
  fv.patient_id,
  ct.encounter_id,
  ct.treatment_id,
  CASE fv.pathway
    WHEN 0 THEN 'Blood pressure'
    WHEN 1 THEN 'Capillary blood glucose'
    ELSE 'Peak expiratory flow'
  END,
  CASE fv.pathway
    WHEN 0 THEN (124 + ((fv.patient_serial + fv.visit_index) % 12))::text || '/' ||
      (78 + ((fv.patient_serial + fv.visit_index) % 8))::text || ' mmHg'
    WHEN 1 THEN (92 + ((fv.patient_serial + fv.visit_index) % 22))::text || ' mg/dL'
    ELSE (400 + ((fv.patient_serial + fv.visit_index) % 70))::text || ' L/min'
  END,
  fv.visit_date,
  1,
  'Fictional specialist follow-up observation for training use.'
FROM follow_up_visits fv
JOIN created_treatments ct
  ON ct.patient_id = fv.patient_id
JOIN created_encounters ce
  ON ce.encounter_id = ct.encounter_id
  AND ce.encounter_date = fv.visit_date;


COMMIT;
