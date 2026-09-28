BEGIN;

/*
 * One-time dental-evidence migration for the fictional ECIS training
 * database. Every row is linked to an existing patient and encounter.
 */

DO $migration_guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.dental_records
    WHERE notes = 'ECIS dental coverage record'
  ) THEN
    RAISE EXCEPTION
      'dental_evidence_coverage.sql has already been applied; refusing to duplicate records.';
  END IF;
END
$migration_guard$;


WITH candidates AS (
  SELECT
    p.patient_id,
    p.patient_number,
    ROW_NUMBER() OVER (ORDER BY p.patient_number) AS row_number
  FROM public.patients p
  WHERE
    p.status = 'ACTIVE'
    AND (
      p.patient_number = 'P000003'
      OR NOT EXISTS (
        SELECT 1
        FROM public.dental_records d
        WHERE d.patient_id = p.patient_id
      )
    )
  ORDER BY
    CASE
      WHEN p.patient_number = 'P000003' THEN 0
      ELSE 1
    END,
    p.patient_number
  LIMIT 400
), linked_encounters AS (
  SELECT
    c.patient_id,
    c.patient_number,
    c.row_number,
    e.encounter_id,
    e.encounter_date,
    CASE
      WHEN c.patient_number = 'P000003' THEN 0
      ELSE c.row_number % 5
    END AS dental_pathway
  FROM candidates c
  CROSS JOIN LATERAL (
    SELECT
      encounter.encounter_id,
      encounter.encounter_date
    FROM public.encounters encounter
    WHERE
      encounter.patient_id = c.patient_id
      AND encounter.encounter_type IN ('OPD', 'CLINIC', 'INPATIENT')
    ORDER BY
      encounter.encounter_date DESC,
      encounter.encounter_id DESC
    LIMIT 1
  ) e
)
INSERT INTO public.dental_records (
  patient_id,
  encounter_id,
  record_date,
  tooth_number,
  condition,
  treatment,
  filling_type,
  crown_present,
  implant_present,
  missing_tooth,
  notes,
  recorded_by
)
SELECT
  le.patient_id,
  le.encounter_id,
  le.encounter_date::date,
  CASE le.dental_pathway
    WHEN 0 THEN '11'
    WHEN 1 THEN '21'
    WHEN 2 THEN '36'
    WHEN 3 THEN '46'
    ELSE '26'
  END,
  CASE le.dental_pathway
    WHEN 0 THEN 'Crown review'
    WHEN 1 THEN 'Early enamel wear'
    WHEN 2 THEN 'Dental caries'
    WHEN 3 THEN 'Missing tooth'
    ELSE 'Gingivitis'
  END,
  CASE le.dental_pathway
    WHEN 0 THEN 'Porcelain crown review'
    WHEN 1 THEN 'Fluoride varnish application'
    WHEN 2 THEN 'Composite restoration'
    WHEN 3 THEN 'Prosthetic referral and oral hygiene advice'
    ELSE 'Scaling and polishing'
  END,
  CASE le.dental_pathway
    WHEN 2 THEN 'Composite'
    ELSE NULL
  END,
  le.dental_pathway = 0,
  (le.row_number % 11) = 0,
  le.dental_pathway = 3,
  'ECIS dental coverage record',
  1
FROM linked_encounters le;


COMMIT;
