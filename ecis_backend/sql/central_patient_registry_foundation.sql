/*
 * Central patient registry foundation.
 *
 * patients.patient_id remains the single longitudinal identity. This table
 * records which hospitals are authorized to work with that patient without
 * duplicating demographics or clinical history. Existing rows are backfilled
 * from patients.hospital_id and no patient record is deleted or rewritten.
 */

BEGIN;

CREATE TABLE IF NOT EXISTS public.patient_hospital_registrations (
  patient_hospital_registration_id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL
    REFERENCES public.patients(patient_id),
  hospital_id BIGINT NOT NULL
    REFERENCES public.hospitals(hospital_id),
  hospital_patient_number VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  registered_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  registered_by BIGINT
    REFERENCES public.hospital_users(user_id),
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE,
  CONSTRAINT chk_patient_hospital_registration_status
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  CONSTRAINT ux_patient_hospital_registration
    UNIQUE (patient_id, hospital_id),
  CONSTRAINT ux_hospital_patient_number
    UNIQUE (hospital_id, hospital_patient_number)
);

CREATE INDEX IF NOT EXISTS idx_patient_hospital_registrations_hospital_active
  ON public.patient_hospital_registrations (hospital_id, patient_id)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_patient_hospital_registrations_patient_active
  ON public.patient_hospital_registrations (patient_id, hospital_id)
  WHERE status = 'ACTIVE';

/* Every existing patient gains one registration at their current hospital. */
INSERT INTO public.patient_hospital_registrations (
  patient_id,
  hospital_id,
  hospital_patient_number,
  status,
  registered_at
)
SELECT
  p.patient_id,
  p.hospital_id,
  p.patient_number,
  CASE
    WHEN p.status = 'ACTIVE' THEN 'ACTIVE'
    ELSE 'INACTIVE'
  END,
  COALESCE(p.registered_at, p.created_at, CURRENT_TIMESTAMP)
FROM public.patients p
ON CONFLICT (patient_id, hospital_id) DO NOTHING;

COMMIT;
