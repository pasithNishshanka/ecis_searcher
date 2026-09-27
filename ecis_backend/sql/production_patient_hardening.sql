BEGIN;

ALTER TABLE public.patients
    ADD COLUMN IF NOT EXISTS allergy_status VARCHAR(30);

UPDATE public.patients
SET allergy_status =
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM public.patient_allergies pa
            WHERE pa.patient_id = patients.patient_id
        )
        THEN 'HAS_ALLERGIES'
        ELSE 'UNKNOWN'
    END
WHERE allergy_status IS NULL;

ALTER TABLE public.patients
    ALTER COLUMN allergy_status SET DEFAULT 'UNKNOWN';

ALTER TABLE public.patients
    ALTER COLUMN allergy_status SET NOT NULL;

ALTER TABLE public.patients
    DROP CONSTRAINT IF EXISTS chk_patients_allergy_status;

ALTER TABLE public.patients
    ADD CONSTRAINT chk_patients_allergy_status
    CHECK (
        allergy_status IN (
            'NO_KNOWN_ALLERGIES',
            'HAS_ALLERGIES',
            'UNKNOWN'
        )
    );

CREATE INDEX IF NOT EXISTS idx_patients_allergy_status
    ON public.patients (
        hospital_id,
        allergy_status
    );

COMMIT;