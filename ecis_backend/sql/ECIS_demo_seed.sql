-- ==========================================================
-- ECIS / EHR DEMONSTRATION SEED DATA
-- ==========================================================
-- Purpose:
--   Populate synthetic hospital data for ECIS testing, demos,
--   screenshots and thesis evaluation.
--
-- IMPORTANT:
--   1. This uses SYNTHETIC data only.
--   2. It does NOT create an ECIS patient table.
--   3. It adds longitudinal EHR records linked to patients.
--   4. It keeps existing rows and avoids duplicate demo rows
--      using ECIS-DEMO-* identifiers / notes.
--
-- Run with:
--   psql -U postgres -d ecis_ehr -f ECIS_demo_seed.sql
--
-- Or paste into pgAdmin Query Tool and execute.
-- ==========================================================

BEGIN;

-- ----------------------------------------------------------
-- 0. Basic prerequisite check
-- ----------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.hospitals) THEN
        RAISE EXCEPTION
            'No hospital exists. Create your hospital first.';
    END IF;
END $$;

-- ----------------------------------------------------------
-- 1. Synthetic patients
-- ----------------------------------------------------------
-- These are deliberately designed so that patient
-- ECIS-DEMO-001 has a strong combination of clues:
-- age + height + weight + blood group + gender + workplace
-- + surgery + fracture + procedure + scar + implant + observation.
-- This is useful for demonstrating multi-clue ranking.
-- ----------------------------------------------------------

INSERT INTO public.patients (
    hospital_id,
    patient_number,
    nic_number,
    passport_number,
    first_name,
    middle_name,
    last_name,
    date_of_birth,
    gender,
    blood_group,
    height_cm,
    weight_kg,
    nationality,
    primary_phone,
    secondary_phone,
    email,
    occupation,
    status
)
SELECT
    (SELECT hospital_id FROM public.hospitals ORDER BY hospital_id LIMIT 1),
    'ECIS-DEMO-001',
    '900000001V',
    NULL,
    'Kasun',
    'Ravindu',
    'Perera',
    '1990-06-15',
    'Male',
    'O+',
    174,
    72,
    'Sri Lankan',
    '0771000001',
    '0711000001',
    'kasun.demo@ecis.test',
    'Engineer',
    'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.patients
    WHERE patient_number = 'ECIS-DEMO-001'
);

INSERT INTO public.patients (
    hospital_id,
    patient_number,
    nic_number,
    passport_number,
    first_name,
    middle_name,
    last_name,
    date_of_birth,
    gender,
    blood_group,
    height_cm,
    weight_kg,
    nationality,
    primary_phone,
    secondary_phone,
    email,
    occupation,
    status
)
SELECT
    (SELECT hospital_id FROM public.hospitals ORDER BY hospital_id LIMIT 1),
    'ECIS-DEMO-002',
    '890000002V',
    NULL,
    'Saman',
    'Madushan',
    'Fernando',
    '1989-11-03',
    'Male',
    'O+',
    171,
    75,
    'Sri Lankan',
    '0714567002',
    NULL,
    'saman.demo@ecis.test',
    'Technician',
    'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.patients
    WHERE patient_number = 'ECIS-DEMO-002'
);

INSERT INTO public.patients (
    hospital_id,
    patient_number,
    nic_number,
    passport_number,
    first_name,
    middle_name,
    last_name,
    date_of_birth,
    gender,
    blood_group,
    height_cm,
    weight_kg,
    nationality,
    primary_phone,
    secondary_phone,
    email,
    occupation,
    status
)
SELECT
    (SELECT hospital_id FROM public.hospitals ORDER BY hospital_id LIMIT 1),
    'ECIS-DEMO-003',
    '920000003V',
    NULL,
    'Ruwan',
    'Nishan',
    'Silva',
    '1992-01-24',
    'Male',
    'A+',
    178,
    80,
    'Sri Lankan',
    '0759000003',
    NULL,
    'ruwan.demo@ecis.test',
    'Driver',
    'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.patients
    WHERE patient_number = 'ECIS-DEMO-003'
);

INSERT INTO public.patients (
    hospital_id,
    patient_number,
    nic_number,
    passport_number,
    first_name,
    middle_name,
    last_name,
    date_of_birth,
    gender,
    blood_group,
    height_cm,
    weight_kg,
    nationality,
    primary_phone,
    secondary_phone,
    email,
    occupation,
    status
)
SELECT
    (SELECT hospital_id FROM public.hospitals ORDER BY hospital_id LIMIT 1),
    'ECIS-DEMO-004',
    '950000004V',
    NULL,
    'Nadeesha',
    'Tharushi',
    'Jayawardena',
    '1995-08-17',
    'Female',
    'B+',
    160,
    58,
    'Sri Lankan',
    '0768000004',
    NULL,
    'nadeesha.demo@ecis.test',
    'Teacher',
    'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.patients
    WHERE patient_number = 'ECIS-DEMO-004'
);

INSERT INTO public.patients (
    hospital_id,
    patient_number,
    nic_number,
    passport_number,
    first_name,
    middle_name,
    last_name,
    date_of_birth,
    gender,
    blood_group,
    height_cm,
    weight_kg,
    nationality,
    primary_phone,
    secondary_phone,
    email,
    occupation,
    status
)
SELECT
    (SELECT hospital_id FROM public.hospitals ORDER BY hospital_id LIMIT 1),
    'ECIS-DEMO-005',
    '870000005V',
    NULL,
    'Chaminda',
    'Prasad',
    'Wickramasinghe',
    '1987-03-11',
    'Male',
    'AB+',
    169,
    68,
    'Sri Lankan',
    '0707000005',
    NULL,
    'chaminda.demo@ecis.test',
    'Accountant',
    'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.patients
    WHERE patient_number = 'ECIS-DEMO-005'
);

INSERT INTO public.patients (
    hospital_id,
    patient_number,
    nic_number,
    passport_number,
    first_name,
    middle_name,
    last_name,
    date_of_birth,
    gender,
    blood_group,
    height_cm,
    weight_kg,
    nationality,
    primary_phone,
    secondary_phone,
    email,
    occupation,
    status
)
SELECT
    (SELECT hospital_id FROM public.hospitals ORDER BY hospital_id LIMIT 1),
    'ECIS-DEMO-006',
    '930000006V',
    NULL,
    'Ishara',
    'Dilshan',
    'Bandara',
    '1993-12-02',
    'Male',
    'O-',
    182,
    84,
    'Sri Lankan',
    '0776000006',
    NULL,
    'ishara.demo@ecis.test',
    'Manager',
    'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.patients
    WHERE patient_number = 'ECIS-DEMO-006'
);

-- ----------------------------------------------------------
-- 2. Get important IDs
-- ----------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.patients
        WHERE patient_number = 'ECIS-DEMO-001'
    ) THEN
        RAISE EXCEPTION 'Demo patient ECIS-DEMO-001 was not created.';
    END IF;
END $$;

-- ----------------------------------------------------------
-- 3. OPD / clinic source encounters
-- ----------------------------------------------------------

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
SELECT
    p.patient_id,
    p.hospital_id,
    'OPD',
    '2027-03-10 09:00:00',
    'Orthopedics',
    'COMPLETED',
    'Right arm pain after fall',
    'ECIS DEMO: Orthopedic assessment for patient 001.'
FROM public.patients p
WHERE p.patient_number = 'ECIS-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM public.encounters e
      WHERE e.patient_id = p.patient_id
        AND e.notes = 'ECIS DEMO: Orthopedic assessment for patient 001.'
  );

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
SELECT
    p.patient_id,
    p.hospital_id,
    'OPD',
    '2028-01-12 10:00:00',
    'Medicine',
    'COMPLETED',
    'General medical review',
    'ECIS DEMO: General review for patient 001.'
FROM public.patients p
WHERE p.patient_number = 'ECIS-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM public.encounters e
      WHERE e.patient_id = p.patient_id
        AND e.notes = 'ECIS DEMO: General review for patient 001.'
  );

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
SELECT
    p.patient_id,
    p.hospital_id,
    'OPD',
    '2028-05-20 11:00:00',
    'Orthopedics',
    'COMPLETED',
    'Post-operative follow-up',
    'ECIS DEMO: Post-operative follow-up for patient 001.'
FROM public.patients p
WHERE p.patient_number = 'ECIS-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM public.encounters e
      WHERE e.patient_id = p.patient_id
        AND e.notes = 'ECIS DEMO: Post-operative follow-up for patient 001.'
  );

-- One encounter for each additional patient
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
SELECT
    p.patient_id,
    p.hospital_id,
    'OPD',
    DATE '2028-06-01' + ((p.patient_id % 20)::integer),
    'General Medicine',
    'COMPLETED',
    'Routine medical review',
    'ECIS DEMO: Routine source encounter.'
FROM public.patients p
WHERE p.patient_number IN (
    'ECIS-DEMO-002',
    'ECIS-DEMO-003',
    'ECIS-DEMO-004',
    'ECIS-DEMO-005',
    'ECIS-DEMO-006'
)
AND NOT EXISTS (
    SELECT 1 FROM public.encounters e
    WHERE e.patient_id = p.patient_id
      AND e.notes = 'ECIS DEMO: Routine source encounter.'
);

-- ----------------------------------------------------------
-- 4. OPD visits
-- ----------------------------------------------------------

INSERT INTO public.opd_visits (
    encounter_id,
    patient_id,
    opd_number,
    doctor_user_id,
    chief_complaint,
    clinical_notes,
    diagnosis_summary,
    follow_up_required,
    follow_up_date,
    status
)
SELECT
    e.encounter_id,
    p.patient_id,
    'ECIS-OPD-001',
    u.user_id,
    'Right arm pain after fall',
    'Tenderness and reduced range of movement at right humerus.',
    'Suspected right humerus fracture',
    TRUE,
    '2027-03-24',
    'COMPLETED'
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Orthopedic assessment for patient 001.'
LEFT JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE p.patient_number = 'ECIS-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM public.opd_visits o
      WHERE o.opd_number = 'ECIS-OPD-001'
  );

INSERT INTO public.opd_visits (
    encounter_id,
    patient_id,
    opd_number,
    doctor_user_id,
    chief_complaint,
    clinical_notes,
    diagnosis_summary,
    follow_up_required,
    follow_up_date,
    status
)
SELECT
    e.encounter_id,
    p.patient_id,
    'ECIS-OPD-002',
    u.user_id,
    'General medical review',
    'Routine clinical review.',
    'Stable general condition',
    FALSE,
    NULL,
    'COMPLETED'
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: General review for patient 001.'
LEFT JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE p.patient_number = 'ECIS-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM public.opd_visits o
      WHERE o.opd_number = 'ECIS-OPD-002'
  );

-- ----------------------------------------------------------
-- 5. Clinics and clinic visits
-- ----------------------------------------------------------

INSERT INTO public.clinics (
    hospital_id,
    clinic_code,
    clinic_name,
    specialty,
    location
)
SELECT
    h.hospital_id,
    'ECIS-ORTHO',
    'Orthopedic Clinic',
    'Orthopedics',
    'Clinic Building - 2nd Floor'
FROM public.hospitals h
ORDER BY h.hospital_id
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.clinics (
    hospital_id,
    clinic_code,
    clinic_name,
    specialty,
    location
)
SELECT
    h.hospital_id,
    'ECIS-MED',
    'Medical Clinic',
    'General Medicine',
    'Clinic Building - 1st Floor'
FROM public.hospitals h
ORDER BY h.hospital_id
LIMIT 1
ON CONFLICT DO NOTHING;

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
SELECT
    p.patient_id,
    p.hospital_id,
    'CLINIC',
    '2029-03-12 09:30:00',
    'Orthopedics',
    'COMPLETED',
    'Post-operative follow-up',
    'ECIS DEMO: Orthopedic clinic follow-up for patient 001.'
FROM public.patients p
WHERE p.patient_number = 'ECIS-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM public.encounters e
      WHERE e.patient_id = p.patient_id
        AND e.notes = 'ECIS DEMO: Orthopedic clinic follow-up for patient 001.'
  );

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
    c.clinic_id,
    e.encounter_id,
    p.patient_id,
    'ECIS-CV-001',
    '2029-03-12 09:30:00',
    u.user_id,
    'Post-operative follow-up',
    'Orthopedic plate and healed surgical scar reviewed.',
    'Healed right humerus fracture post fixation',
    TRUE,
    '2029-09-12',
    'COMPLETED'
FROM public.clinics c
JOIN public.patients p
  ON p.patient_number = 'ECIS-DEMO-001'
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Orthopedic clinic follow-up for patient 001.'
LEFT JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE c.clinic_code = 'ECIS-ORTHO'
  AND NOT EXISTS (
      SELECT 1 FROM public.clinic_visits cv
      WHERE cv.visit_number = 'ECIS-CV-001'
  );

-- ----------------------------------------------------------
-- 6. Wards and beds
-- ----------------------------------------------------------

INSERT INTO public.wards (
    hospital_id,
    ward_code,
    ward_name,
    ward_type,
    floor,
    location,
    capacity,
    gender_policy
)
SELECT
    h.hospital_id,
    'ECIS-W01',
    'ECIS Orthopedic Ward',
    'INPATIENT',
    '2',
    'Main Building - 2nd Floor',
    10,
    'MIXED'
FROM public.hospitals h
ORDER BY h.hospital_id
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.wards (
    hospital_id,
    ward_code,
    ward_name,
    ward_type,
    floor,
    location,
    capacity,
    gender_policy
)
SELECT
    h.hospital_id,
    'ECIS-W02',
    'ECIS Medical Ward',
    'INPATIENT',
    '1',
    'Main Building - 1st Floor',
    10,
    'MIXED'
FROM public.hospitals h
ORDER BY h.hospital_id
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.beds (
    ward_id,
    bed_number,
    bed_type,
    status
)
SELECT
    w.ward_id,
    'ECIS-A01',
    'STANDARD',
    'AVAILABLE'
FROM public.wards w
WHERE w.ward_code = 'ECIS-W01'
  AND NOT EXISTS (
      SELECT 1 FROM public.beds b
      WHERE b.ward_id = w.ward_id
        AND b.bed_number = 'ECIS-A01'
  );

INSERT INTO public.beds (
    ward_id,
    bed_number,
    bed_type,
    status
)
SELECT
    w.ward_id,
    'ECIS-A02',
    'STANDARD',
    'AVAILABLE'
FROM public.wards w
WHERE w.ward_code = 'ECIS-W01'
  AND NOT EXISTS (
      SELECT 1 FROM public.beds b
      WHERE b.ward_id = w.ward_id
        AND b.bed_number = 'ECIS-A02'
  );

INSERT INTO public.beds (
    ward_id,
    bed_number,
    bed_type,
    status
)
SELECT
    w.ward_id,
    'ECIS-M01',
    'STANDARD',
    'AVAILABLE'
FROM public.wards w
WHERE w.ward_code = 'ECIS-W02'
  AND NOT EXISTS (
      SELECT 1 FROM public.beds b
      WHERE b.ward_id = w.ward_id
        AND b.bed_number = 'ECIS-M01'
  );

-- ----------------------------------------------------------
-- 7. Ward encounter + admission for main candidate
-- ----------------------------------------------------------

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
SELECT
    p.patient_id,
    p.hospital_id,
    'WARD',
    '2027-03-11 08:00:00',
    'Orthopedic Ward',
    'COMPLETED',
    'Right humerus fracture',
    'ECIS DEMO: Orthopedic admission for patient 001.'
FROM public.patients p
WHERE p.patient_number = 'ECIS-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM public.encounters e
      WHERE e.patient_id = p.patient_id
        AND e.notes = 'ECIS DEMO: Orthopedic admission for patient 001.'
  );

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
    p.patient_id,
    e.encounter_id,
    w.ward_id,
    b.bed_id,
    'ECIS-ADM-001',
    '2027-03-11 08:00:00',
    'Fall injury with right arm pain',
    'Right humerus fracture',
    u.user_id,
    'ADMITTED'
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Orthopedic admission for patient 001.'
JOIN public.wards w
  ON w.ward_code = 'ECIS-W01'
JOIN public.beds b
  ON b.ward_id = w.ward_id
 AND b.bed_number = 'ECIS-A01'
LEFT JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE p.patient_number = 'ECIS-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM public.admissions a
      WHERE a.admission_number = 'ECIS-ADM-001'
  );

UPDATE public.beds
SET
    status = 'OCCUPIED',
    updated_at = CURRENT_TIMESTAMP
WHERE bed_number = 'ECIS-A01'
  AND ward_id = (
      SELECT ward_id
      FROM public.wards
      WHERE ward_code = 'ECIS-W01'
      LIMIT 1
  );

-- ----------------------------------------------------------
-- 8. Treatment records
-- ----------------------------------------------------------
-- treatment_records.encounter_id is NOT NULL in the current
-- ECIS database. Every synthetic treatment therefore links
-- to a real encounter for the same patient.
-- ----------------------------------------------------------

INSERT INTO public.treatment_records (
    patient_id,
    encounter_id,
    opd_visit_id,
    clinic_visit_id,
    admission_id,
    emergency_case_id,
    treatment_date,
    treatment_type,
    treatment_name,
    description,
    body_site,
    laterality,
    performed_by,
    outcome,
    complications
)
SELECT
    p.patient_id,
    e.encounter_id,
    NULL,
    NULL,
    a.admission_id,
    NULL,
    '2027-03-12 14:00:00',
    'SURGERY',
    'ORIF Right Humerus',
    'Open reduction and internal fixation of right humerus fracture using orthopedic plate.',
    'Right arm',
    'RIGHT',
    u.user_id,
    'Successful fixation and recovery',
    NULL
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Orthopedic admission for patient 001.'
LEFT JOIN public.admissions a
  ON a.admission_number = 'ECIS-ADM-001'
LEFT JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE p.patient_number = 'ECIS-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM public.treatment_records t
      WHERE t.patient_id = p.patient_id
        AND t.treatment_name = 'ORIF Right Humerus'
  );

INSERT INTO public.treatment_records (
    patient_id,
    encounter_id,
    opd_visit_id,
    clinic_visit_id,
    admission_id,
    emergency_case_id,
    treatment_date,
    treatment_type,
    treatment_name,
    description,
    body_site,
    laterality,
    performed_by,
    outcome,
    complications
)
SELECT
    p.patient_id,
    e.encounter_id,
    NULL,
    cv.clinic_visit_id,
    NULL,
    NULL,
    '2029-03-12 09:30:00',
    'CLINIC',
    'Implant and scar review',
    'Long-term review of orthopedic implant and healed surgical scar.',
    'Right arm',
    'RIGHT',
    u.user_id,
    'Stable',
    NULL
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Orthopedic clinic follow-up for patient 001.'
LEFT JOIN public.clinic_visits cv
  ON cv.encounter_id = e.encounter_id
LEFT JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE p.patient_number = 'ECIS-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM public.treatment_records t
      WHERE t.patient_id = p.patient_id
        AND t.treatment_name = 'Implant and scar review'
  );

-- Source treatments for other patients
INSERT INTO public.treatment_records (
    patient_id,
    encounter_id,
    treatment_date,
    treatment_type,
    treatment_name,
    description,
    body_site,
    laterality,
    performed_by,
    outcome,
    complications
)
SELECT
    p.patient_id,
    e.encounter_id,
    '2028-02-10 10:00:00',
    'OPD',
    CASE p.patient_number
        WHEN 'ECIS-DEMO-002' THEN 'Fracture follow-up'
        WHEN 'ECIS-DEMO-003' THEN 'Blood pressure review'
        WHEN 'ECIS-DEMO-004' THEN 'Migraine treatment review'
        WHEN 'ECIS-DEMO-005' THEN 'Diabetes medication review'
        ELSE 'Back pain review'
    END,
    'ECIS DEMO: Routine treatment source record.',
    NULL,
    NULL,
    u.user_id,
    'Stable',
    NULL
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Routine source encounter.'
LEFT JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE p.patient_number IN (
    'ECIS-DEMO-002',
    'ECIS-DEMO-003',
    'ECIS-DEMO-004',
    'ECIS-DEMO-005',
    'ECIS-DEMO-006'
)
AND NOT EXISTS (
    SELECT 1 FROM public.treatment_records t
    WHERE t.patient_id = p.patient_id
      AND t.description = 'ECIS DEMO: Routine treatment source record.'
);

-- ----------------------------------------------------------
-- 9. Clinical observations
-- ----------------------------------------------------------

INSERT INTO public.clinical_observations (
    patient_id,
    encounter_id,
    treatment_id,
    observation_type,
    observation_value,
    body_site,
    laterality,
    observed_date,
    recorded_by,
    notes
)
SELECT
    p.patient_id,
    e.encounter_id,
    NULL,
    'SURGICAL_SCAR',
    'Long healed surgical scar on right forearm',
    'Right forearm',
    'RIGHT',
    '2029-03-12 09:30:00',
    u.user_id,
    'ECIS DEMO: Stable physical finding useful for identity review.'
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Orthopedic clinic follow-up for patient 001.'
LEFT JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE p.patient_number = 'ECIS-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM public.clinical_observations co
      WHERE co.patient_id = p.patient_id
        AND co.observation_type = 'SURGICAL_SCAR'
        AND co.observation_value = 'Long healed surgical scar on right forearm'
  );

INSERT INTO public.clinical_observations (
    patient_id,
    encounter_id,
    observation_type,
    observation_value,
    body_site,
    laterality,
    observed_date,
    recorded_by,
    notes
)
SELECT
    p.patient_id,
    e.encounter_id,
    'BIRTHMARK',
    'Small brown birthmark near left shoulder',
    'Left shoulder',
    'LEFT',
    '2029-04-05 10:00:00',
    u.user_id,
    'ECIS DEMO: Birthmark source record.'
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Routine source encounter.'
LEFT JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE p.patient_number = 'ECIS-DEMO-002'
  AND NOT EXISTS (
      SELECT 1 FROM public.clinical_observations co
      WHERE co.patient_id = p.patient_id
        AND co.observation_type = 'BIRTHMARK'
        AND co.observation_value LIKE 'Small brown birthmark%'
  );

INSERT INTO public.clinical_observations (
    patient_id,
    encounter_id,
    observation_type,
    observation_value,
    body_site,
    laterality,
    observed_date,
    recorded_by,
    notes
)
SELECT
    p.patient_id,
    e.encounter_id,
    'TATTOO',
    'Small geometric tattoo on right wrist',
    'Right wrist',
    'RIGHT',
    '2029-04-05 10:00:00',
    u.user_id,
    'ECIS DEMO: Tattoo source record.'
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Routine source encounter.'
LEFT JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE p.patient_number = 'ECIS-DEMO-003'
  AND NOT EXISTS (
      SELECT 1 FROM public.clinical_observations co
      WHERE co.patient_id = p.patient_id
        AND co.observation_type = 'TATTOO'
        AND co.observation_value LIKE 'Small geometric tattoo%'
  );

-- ----------------------------------------------------------
-- 10. Investigations
-- ----------------------------------------------------------

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
    body_site,
    performed_by,
    report_reference
)
SELECT
    p.patient_id,
    e.encounter_id,
    'IMAGING',
    'X-Ray Right Humerus',
    '2027-03-10',
    '2027-03-10',
    'Comminuted fracture of right humerus.',
    NULL,
    NULL,
    NULL,
    'Right humerus',
    u.user_id,
    'ECIS-RPT-XR-001'
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Orthopedic assessment for patient 001.'
LEFT JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE p.patient_number = 'ECIS-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM public.investigations i
      WHERE i.patient_id = p.patient_id
        AND i.investigation_name = 'X-Ray Right Humerus'
  );

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
    body_site,
    performed_by,
    report_reference
)
SELECT
    p.patient_id,
    e.encounter_id,
    'LAB',
    'Full Blood Count',
    '2029-03-12',
    '2029-03-12',
    'Within normal limits.',
    '5.2',
    'x10^9/L',
    '4.0-11.0',
    NULL,
    u.user_id,
    'ECIS-RPT-FBC-001'
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Orthopedic clinic follow-up for patient 001.'
LEFT JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE p.patient_number = 'ECIS-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM public.investigations i
      WHERE i.patient_id = p.patient_id
        AND i.investigation_name = 'Full Blood Count'
  );

-- ----------------------------------------------------------
-- 11. Medical conditions
-- ----------------------------------------------------------

INSERT INTO public.medical_conditions (
    condition_code,
    condition_name,
    description
)
VALUES
    ('ECIS-C01', 'Right Humerus Fracture', 'Historical right humerus fracture.'),
    ('ECIS-C02', 'Hypertension', 'Essential hypertension.'),
    ('ECIS-C03', 'Asthma', 'History of asthma.'),
    ('ECIS-C04', 'Migraine', 'Recurrent migraine.'),
    ('ECIS-C05', 'Type 2 Diabetes Mellitus', 'Type 2 diabetes.'),
    ('ECIS-C06', 'Chronic Back Pain', 'Chronic mechanical back pain.')
ON CONFLICT DO NOTHING;

INSERT INTO public.patient_conditions (
    patient_id,
    condition_id,
    encounter_id,
    diagnosis_date,
    condition_status,
    severity,
    notes
)
SELECT
    p.patient_id,
    c.condition_id,
    e.encounter_id,
    '2027-03-10',
    'RESOLVED',
    'MODERATE',
    'ECIS DEMO: Historical fracture linked to later surgery.'
FROM public.patients p
JOIN public.medical_conditions c
  ON c.condition_code = 'ECIS-C01'
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Orthopedic assessment for patient 001.'
WHERE p.patient_number = 'ECIS-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM public.patient_conditions pc
      WHERE pc.patient_id = p.patient_id
        AND pc.condition_id = c.condition_id
  );

INSERT INTO public.patient_conditions (
    patient_id,
    condition_id,
    encounter_id,
    diagnosis_date,
    condition_status,
    severity,
    notes
)
SELECT
    p.patient_id,
    c.condition_id,
    e.encounter_id,
    (CASE p.patient_number
        WHEN 'ECIS-DEMO-002' THEN DATE '2028-01-10'
        WHEN 'ECIS-DEMO-003' THEN DATE '2028-01-15'
        WHEN 'ECIS-DEMO-004' THEN DATE '2028-02-01'
        WHEN 'ECIS-DEMO-005' THEN DATE '2028-02-05'
        ELSE DATE '2028-02-10'
    END),
    'ACTIVE',
    'MILD',
    'ECIS DEMO: Synthetic chronic/source condition.'
FROM public.patients p
JOIN public.medical_conditions c
  ON c.condition_code = CASE p.patient_number
        WHEN 'ECIS-DEMO-002' THEN 'ECIS-C03'
        WHEN 'ECIS-DEMO-003' THEN 'ECIS-C02'
        WHEN 'ECIS-DEMO-004' THEN 'ECIS-C04'
        WHEN 'ECIS-DEMO-005' THEN 'ECIS-C05'
        ELSE 'ECIS-C06'
     END
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Routine source encounter.'
WHERE p.patient_number IN (
    'ECIS-DEMO-002',
    'ECIS-DEMO-003',
    'ECIS-DEMO-004',
    'ECIS-DEMO-005',
    'ECIS-DEMO-006'
)
AND NOT EXISTS (
    SELECT 1 FROM public.patient_conditions pc
    WHERE pc.patient_id = p.patient_id
      AND pc.condition_id = c.condition_id
);

-- ----------------------------------------------------------
-- 12. Fracture source record
-- ----------------------------------------------------------

INSERT INTO public.fractures (
    patient_id,
    encounter_id,
    body_part,
    laterality,
    fracture_type,
    fracture_date,
    treatment_description,
    healed_date,
    notes
)
SELECT
    p.patient_id,
    e.encounter_id,
    'Humerus',
    'RIGHT',
    'Comminuted fracture',
    '2027-03-10',
    'Open reduction and internal fixation with orthopedic plate.',
    '2027-06-15',
    'ECIS DEMO: Historical fracture, right arm.'
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Orthopedic assessment for patient 001.'
WHERE p.patient_number = 'ECIS-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM public.fractures f
      WHERE f.patient_id = p.patient_id
        AND f.body_part = 'Humerus'
        AND f.laterality = 'RIGHT'
  );

INSERT INTO public.fractures (
    patient_id,
    encounter_id,
    body_part,
    laterality,
    fracture_type,
    fracture_date,
    treatment_description,
    healed_date,
    notes
)
SELECT
    p.patient_id,
    e.encounter_id,
    'Radius',
    'LEFT',
    'Simple fracture',
    '2026-08-12',
    'Conservative immobilization.',
    '2026-10-01',
    'ECIS DEMO: Secondary fracture source record.'
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Routine source encounter.'
WHERE p.patient_number = 'ECIS-DEMO-002'
  AND NOT EXISTS (
      SELECT 1 FROM public.fractures f
      WHERE f.patient_id = p.patient_id
        AND f.body_part = 'Radius'
  );

-- ----------------------------------------------------------
-- 13. Surgery source record
-- ----------------------------------------------------------

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
    p.patient_id,
    e.encounter_id,
    a.admission_id,
    'ORIF-RH-001',
    'Open Reduction Internal Fixation - Right Humerus',
    '2027-03-12 14:00:00',
    'Right humerus',
    'RIGHT',
    u.user_id,
    'Right humerus comminuted fracture',
    'Right humerus fracture stabilized with internal fixation',
    'Fracture reduced and orthopedic plate applied.',
    NULL,
    'ECIS DEMO: Surgical history containing stable identity clues.'
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Orthopedic admission for patient 001.'
LEFT JOIN public.admissions a
  ON a.admission_number = 'ECIS-ADM-001'
LEFT JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE p.patient_number = 'ECIS-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM public.surgeries s
      WHERE s.surgery_code = 'ORIF-RH-001'
  );

INSERT INTO public.surgeries (
    patient_id,
    encounter_id,
    surgery_code,
    surgery_name,
    surgery_date,
    body_site,
    laterality,
    surgeon_user_id,
    preoperative_diagnosis,
    postoperative_diagnosis,
    findings,
    surgical_notes
)
SELECT
    p.patient_id,
    e.encounter_id,
    'ECIS-APP-002',
    'Appendectomy',
    '2026-11-08 12:00:00',
    'Abdomen',
    NULL,
    u.user_id,
    'Acute appendicitis',
    'Appendicitis successfully treated',
    'Inflamed appendix removed.',
    'ECIS DEMO: Secondary surgical history.'
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Routine source encounter.'
LEFT JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE p.patient_number = 'ECIS-DEMO-002'
  AND NOT EXISTS (
      SELECT 1 FROM public.surgeries s
      WHERE s.surgery_code = 'ECIS-APP-002'
  );

-- ----------------------------------------------------------
-- 14. Procedure records
-- ----------------------------------------------------------

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
    p.patient_id,
    e.encounter_id,
    'PROC-ORIF-001',
    'Fracture Fixation',
    '2027-03-12 14:30:00',
    'Right humerus',
    'RIGHT',
    u.user_id,
    'Right humerus fracture',
    'Internal fixation performed with orthopedic plate.',
    'Successful'
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Orthopedic admission for patient 001.'
LEFT JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE p.patient_number = 'ECIS-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM public.procedures pr
      WHERE pr.procedure_code = 'PROC-ORIF-001'
  );

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
    p.patient_id,
    e.encounter_id,
    'PROC-XR-002',
    'Follow-up X-Ray Review',
    '2029-03-12 10:00:00',
    'Right arm',
    'RIGHT',
    u.user_id,
    'Post-operative follow-up',
    'Stable orthopedic plate position.',
    'No further intervention'
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Orthopedic clinic follow-up for patient 001.'
LEFT JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE p.patient_number = 'ECIS-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM public.procedures pr
      WHERE pr.procedure_code = 'PROC-XR-002'
  );

-- ----------------------------------------------------------
-- 15. Medical device / implant
-- ----------------------------------------------------------

INSERT INTO public.medical_devices (
    patient_id,
    encounter_id,
    device_type,
    device_name,
    manufacturer,
    model_number,
    serial_number,
    body_site,
    laterality,
    implantation_date,
    removal_date,
    status,
    notes
)
SELECT
    p.patient_id,
    e.encounter_id,
    'ORTHOPEDIC_IMPLANT',
    'Orthopedic Plate',
    'SynthoMed',
    'RH-PLATE-01',
    'ECIS-ORTHO-78421',
    'Right humerus',
    'RIGHT',
    '2027-03-12',
    NULL,
    'ACTIVE',
    'ECIS DEMO: Permanent orthopedic implant used as strong supporting evidence.'
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Orthopedic admission for patient 001.'
WHERE p.patient_number = 'ECIS-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM public.medical_devices md
      WHERE md.serial_number = 'ECIS-ORTHO-78421'
  );

INSERT INTO public.medical_devices (
    patient_id,
    encounter_id,
    device_type,
    device_name,
    manufacturer,
    model_number,
    serial_number,
    body_site,
    laterality,
    implantation_date,
    status,
    notes
)
SELECT
    p.patient_id,
    e.encounter_id,
    'DENTAL_IMPLANT',
    'Dental Implant',
    'DentalCare',
    'DI-002',
    'ECIS-DENTAL-002',
    'Lower molar',
    'RIGHT',
    '2028-01-15',
    'ACTIVE',
    'ECIS DEMO: Secondary implant source record.'
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Routine source encounter.'
WHERE p.patient_number = 'ECIS-DEMO-003'
  AND NOT EXISTS (
      SELECT 1 FROM public.medical_devices md
      WHERE md.serial_number = 'ECIS-DENTAL-002'
  );

-- ----------------------------------------------------------
-- 16. Dental records
-- ----------------------------------------------------------

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
    recorded_by,
    notes
)
SELECT
    p.patient_id,
    e.encounter_id,
    '2029-03-20',
    '11',
    'Healed previous restoration',
    'Routine dental review',
    'Composite',
    FALSE,
    FALSE,
    FALSE,
    u.user_id,
    'ECIS DEMO: Stable dental record.'
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Orthopedic clinic follow-up for patient 001.'
LEFT JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE p.patient_number = 'ECIS-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM public.dental_records d
      WHERE d.patient_id = p.patient_id
        AND d.tooth_number = '11'
  );

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
    recorded_by,
    notes
)
SELECT
    p.patient_id,
    e.encounter_id,
    '2029-03-20',
    '46',
    'Dental implant present',
    'Implant review',
    NULL,
    FALSE,
    TRUE,
    FALSE,
    u.user_id,
    'ECIS DEMO: Dental implant record for supporting match evidence.'
FROM public.patients p
JOIN public.encounters e
  ON e.patient_id = p.patient_id
 AND e.notes = 'ECIS DEMO: Routine source encounter.'
LEFT JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE p.patient_number = 'ECIS-DEMO-003'
  AND NOT EXISTS (
      SELECT 1 FROM public.dental_records d
      WHERE d.patient_id = p.patient_id
        AND d.tooth_number = '46'
  );

-- 17. Emergency cases
-- ----------------------------------------------------------
-- The first case is the key unidentified case to use for ECIS.
-- Its permanent patient_id is NULL.
-- ----------------------------------------------------------

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
SELECT
    h.hospital_id,
    NULL,
    NULL,
    'ECIS-EMG-001',
    CURRENT_TIMESTAMP,
    'AMBULANCE',
    'RED',
    'Road traffic accident - unidentified adult male',
    'Unidentified trauma patient with possible right arm injury.',
    TRUE,
    'TEMP-ECIS-001',
    u.user_id,
    'IDENTIFICATION_PENDING'
FROM public.hospitals h
LEFT JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE NOT EXISTS (
    SELECT 1 FROM public.emergency_cases e
    WHERE e.case_number = 'ECIS-EMG-001'
);

-- Identified emergency case for another patient
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
SELECT
    p.hospital_id,
    NULL,
    p.patient_id,
    'ECIS-EMG-002',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    'WALK_IN',
    'YELLOW',
    'Chest pain',
    'Known patient, stable condition.',
    FALSE,
    NULL,
    u.user_id,
    'IN_TREATMENT'
FROM public.patients p
LEFT JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE p.patient_number = 'ECIS-DEMO-003'
  AND NOT EXISTS (
      SELECT 1 FROM public.emergency_cases e
      WHERE e.case_number = 'ECIS-EMG-002'
  );

-- ----------------------------------------------------------
-- 18. Optional sample search log
-- ----------------------------------------------------------
-- This is only one example audit record. Real searches will
-- automatically create additional logs through the API.
-- ----------------------------------------------------------

INSERT INTO public.ecis_search_logs (
    emergency_case_id,
    searched_by,
    search_criteria,
    result_count
)
SELECT
    e.emergency_case_id,
    u.user_id,
    jsonb_build_object(
        'ageMin', 25,
        'ageMax', 40,
        'heightMin', 165,
        'heightMax', 180,
        'weightMin', 65,
        'weightMax', 80,
        'bloodGroup', 'O+',
        'gender', 'Male',
        'partialName', 'Kasun',
        'previousSurgery', 'humerus',
        'fracture', 'humerus',
        'implantOrDevice', 'orthopedic plate'
    ),
    2
FROM public.emergency_cases e
JOIN public.hospital_users u
  ON u.username = 'dr.kamal'
WHERE e.case_number = 'ECIS-EMG-001'
  AND NOT EXISTS (
      SELECT 1
      FROM public.ecis_search_logs l
      WHERE l.emergency_case_id = e.emergency_case_id
        AND l.search_criteria @> '{"partialName":"Kasun"}'::jsonb
  );

-- ----------------------------------------------------------
-- 19. Refresh identity sequences where supported
-- ----------------------------------------------------------
-- PostgreSQL BIGSERIAL/SERIAL sequences are normally advanced
-- automatically by INSERT. No manual sequence reset is needed
-- because this script does not force identity IDs.
-- ----------------------------------------------------------

COMMIT;

-- ==========================================================
-- 20. Verification queries
-- ==========================================================

SELECT
    patient_id,
    patient_number,
    first_name,
    last_name,
    blood_group,
    height_cm,
    weight_kg,
    occupation
FROM public.patients
WHERE patient_number LIKE 'ECIS-DEMO-%'
ORDER BY patient_number;

SELECT
    emergency_case_id,
    case_number,
    patient_id,
    unidentified_patient,
    temporary_identity_reference,
    status
FROM public.emergency_cases
WHERE case_number LIKE 'ECIS-EMG-%'
ORDER BY emergency_case_id;

SELECT
    p.patient_number,
    COUNT(DISTINCT s.surgery_id) AS surgeries,
    COUNT(DISTINCT f.fracture_id) AS fractures,
    COUNT(DISTINCT md.device_id) AS devices,
    COUNT(DISTINCT co.observation_id) AS observations,
    COUNT(DISTINCT i.investigation_id) AS investigations,
    COUNT(DISTINCT pr.procedure_id) AS procedures,
    COUNT(DISTINCT d.dental_record_id) AS dental_records
FROM public.patients p
LEFT JOIN public.surgeries s
    ON s.patient_id = p.patient_id
LEFT JOIN public.fractures f
    ON f.patient_id = p.patient_id
LEFT JOIN public.medical_devices md
    ON md.patient_id = p.patient_id
LEFT JOIN public.clinical_observations co
    ON co.patient_id = p.patient_id
LEFT JOIN public.investigations i
    ON i.patient_id = p.patient_id
LEFT JOIN public.procedures pr
    ON pr.patient_id = p.patient_id
LEFT JOIN public.dental_records d
    ON d.patient_id = p.patient_id
WHERE p.patient_number LIKE 'ECIS-DEMO-%'
GROUP BY p.patient_number
ORDER BY p.patient_number;

-- ==========================================================
-- Recommended ECIS test criteria for ECIS-EMG-001
-- ==========================================================
-- Age range:        30 - 40
-- Height range:     170 - 178
-- Weight range:     68 - 76
-- Blood group:      O+
-- Gender:            Male
-- Workplace:        Engineer
-- Previous surgery: humerus
-- Fracture:          humerus
-- Implant/device:    orthopedic plate
-- Clinical finding: surgical scar
-- Body region:       right arm
--
-- Expected strongest candidate:
--   ECIS-DEMO-001 / Kasun Perera
--
-- The score is an explainable heuristic, not a probability of identity.
-- ==========================================================
