/*
 * Multi-hospital / multi-user foundation.
 *
 * This migration preserves the existing hospital_users rows and creates
 * explicit active assignments. Each existing user receives one assignment
 * for their current hospital and role; additional real assignments can be
 * added later without duplicating a patient or clinical record.
 */

BEGIN;

CREATE TABLE IF NOT EXISTS public.hospital_user_assignments (
  assignment_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL
    REFERENCES public.hospital_users(user_id),
  hospital_id BIGINT NOT NULL
    REFERENCES public.hospitals(hospital_id),
  role VARCHAR(64) NOT NULL,
  department VARCHAR(150),
  designation VARCHAR(150),
  license_number VARCHAR(100),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE,
  CONSTRAINT chk_hospital_user_assignment_status
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ENDED')),
  CONSTRAINT chk_hospital_user_assignment_dates
    CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_hospital_user_assignments_active_role
  ON public.hospital_user_assignments (user_id, hospital_id, role)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_hospital_user_assignments_user_active
  ON public.hospital_user_assignments (user_id, hospital_id)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_hospital_user_assignments_hospital_active
  ON public.hospital_user_assignments (hospital_id, role)
  WHERE status = 'ACTIVE';

/* Backfill, without changing any existing user, hospital, or clinical row. */
INSERT INTO public.hospital_user_assignments (
  user_id,
  hospital_id,
  role,
  department,
  start_date,
  status
)
SELECT
  u.user_id,
  u.hospital_id,
  u.role,
  u.department,
  CURRENT_DATE,
  CASE
    WHEN u.is_active THEN 'ACTIVE'
    ELSE 'INACTIVE'
  END
FROM public.hospital_users u
WHERE NOT EXISTS (
  SELECT 1
  FROM public.hospital_user_assignments a
  WHERE
    a.user_id = u.user_id
    AND a.hospital_id = u.hospital_id
    AND a.role = u.role
);

COMMIT;
