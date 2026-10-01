-- Internal ECIS identifier; never a professional registration or license number.
BEGIN;

ALTER TABLE public.hospital_users
  ADD COLUMN IF NOT EXISTS internal_clinician_id VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS ux_hospital_users_internal_clinician_id
  ON public.hospital_users (internal_clinician_id)
  WHERE internal_clinician_id IS NOT NULL;

SELECT pg_advisory_xact_lock(hashtext('ecis:clinician-id'));

WITH current_max AS (
  SELECT COALESCE(MAX(SUBSTRING(internal_clinician_id FROM '^ECIS-CLIN-([0-9]+)$')::bigint), 0) AS last_number
  FROM public.hospital_users
  WHERE internal_clinician_id ~ '^ECIS-CLIN-[0-9]+$'
), missing AS (
  SELECT u.user_id, ROW_NUMBER() OVER (ORDER BY u.user_id) AS ordinal
  FROM public.hospital_users AS u
  WHERE u.internal_clinician_id IS NULL
    AND (
      u.role IN ('DOCTOR', 'NURSE', 'SURGEON', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'PHARMACIST')
      OR EXISTS (
        SELECT 1
        FROM public.hospital_user_assignments AS a
        WHERE a.user_id = u.user_id
          AND a.status = 'ACTIVE'
          AND a.role IN ('DOCTOR', 'NURSE', 'SURGEON', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'PHARMACIST')
      )
    )
)
UPDATE public.hospital_users AS u
SET internal_clinician_id = 'ECIS-CLIN-' || LPAD((current_max.last_number + missing.ordinal)::text, 4, '0'),
    updated_at = CURRENT_TIMESTAMP
FROM missing, current_max
WHERE u.user_id = missing.user_id;

COMMIT;
