-- Registration photos are encrypted at the application layer and scoped to patients.
CREATE TABLE IF NOT EXISTS public.patient_identity_photos (
  patient_id BIGINT PRIMARY KEY REFERENCES public.patients(patient_id),
  hospital_id BIGINT NOT NULL REFERENCES public.hospitals(hospital_id),
  uploaded_by BIGINT NOT NULL REFERENCES public.hospital_users(user_id),
  ciphertext BYTEA NOT NULL,
  iv BYTEA NOT NULL,
  tag BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.patient_identity_photo_events (
  event_id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL REFERENCES public.patients(patient_id),
  hospital_id BIGINT NOT NULL REFERENCES public.hospitals(hospital_id),
  actor_user_id BIGINT NOT NULL REFERENCES public.hospital_users(user_id),
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('ADDED', 'REPLACED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
