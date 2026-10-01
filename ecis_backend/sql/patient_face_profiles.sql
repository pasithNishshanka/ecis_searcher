-- Optional ECIS biometric clue. No source photos are retained by this table.
CREATE TABLE IF NOT EXISTS public.patient_face_profiles (
  patient_id BIGINT PRIMARY KEY REFERENCES public.patients(patient_id),
  enrolled_hospital_id BIGINT NOT NULL REFERENCES public.hospitals(hospital_id),
  enrolled_by BIGINT NOT NULL REFERENCES public.hospital_users(user_id),
  model_id VARCHAR(100) NOT NULL,
  descriptor_ciphertext BYTEA NOT NULL,
  descriptor_iv BYTEA NOT NULL,
  descriptor_tag BYTEA NOT NULL,
  consent_recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.patient_face_profile_events (
  event_id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL REFERENCES public.patients(patient_id),
  hospital_id BIGINT NOT NULL REFERENCES public.hospitals(hospital_id),
  actor_user_id BIGINT NOT NULL REFERENCES public.hospital_users(user_id),
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('ENROLLED', 'REPLACED', 'REMOVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
