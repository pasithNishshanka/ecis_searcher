-- Optional ECIS biometric clue and encrypted registration photo.
CREATE TABLE IF NOT EXISTS public.patient_face_profiles (
  patient_id BIGINT PRIMARY KEY REFERENCES public.patients(patient_id),
  enrolled_hospital_id BIGINT NOT NULL REFERENCES public.hospitals(hospital_id),
  enrolled_by BIGINT NOT NULL REFERENCES public.hospital_users(user_id),
  model_id VARCHAR(100) NOT NULL,
  descriptor_ciphertext BYTEA NOT NULL,
  descriptor_iv BYTEA NOT NULL,
  descriptor_tag BYTEA NOT NULL,
  photo_ciphertext BYTEA,
  photo_iv BYTEA,
  photo_tag BYTEA,
  consent_recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.patient_face_profiles
  ADD COLUMN IF NOT EXISTS photo_ciphertext BYTEA,
  ADD COLUMN IF NOT EXISTS photo_iv BYTEA,
  ADD COLUMN IF NOT EXISTS photo_tag BYTEA;

CREATE TABLE IF NOT EXISTS public.patient_face_profile_events (
  event_id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL REFERENCES public.patients(patient_id),
  hospital_id BIGINT NOT NULL REFERENCES public.hospitals(hospital_id),
  actor_user_id BIGINT NOT NULL REFERENCES public.hospital_users(user_id),
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('ENROLLED', 'REPLACED', 'REMOVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
