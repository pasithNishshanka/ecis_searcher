/*
 * Secure radiology image metadata.
 *
 * The image bytes are stored on the application server in a private storage
 * directory. They must never be served as a public/static folder. Every read
 * goes through the authenticated radiology image endpoint.
 */

CREATE TABLE IF NOT EXISTS public.radiology_images (
  radiology_image_id BIGSERIAL PRIMARY KEY,
  investigation_id BIGINT NOT NULL
    REFERENCES public.investigations(investigation_id)
    ON DELETE CASCADE,
  patient_id BIGINT NOT NULL
    REFERENCES public.patients(patient_id)
    ON DELETE CASCADE,
  hospital_id BIGINT NOT NULL
    REFERENCES public.hospitals(hospital_id),
  storage_key VARCHAR(120) NOT NULL UNIQUE,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  checksum_sha256 CHAR(64) NOT NULL,
  uploaded_by BIGINT NOT NULL
    REFERENCES public.hospital_users(user_id),
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT radiology_images_mime_type_check CHECK (
    mime_type IN (
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/dicom'
    )
  )
);

CREATE INDEX IF NOT EXISTS radiology_images_investigation_idx
  ON public.radiology_images(investigation_id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS radiology_images_hospital_idx
  ON public.radiology_images(hospital_id)
  WHERE is_active = TRUE;


/*
 * Viewing a clinical image is itself an auditable event.
 */
CREATE TABLE IF NOT EXISTS public.radiology_image_access_logs (
  radiology_image_access_log_id BIGSERIAL PRIMARY KEY,
  radiology_image_id BIGINT NOT NULL
    REFERENCES public.radiology_images(radiology_image_id)
    ON DELETE CASCADE,
  accessed_by BIGINT NOT NULL
    REFERENCES public.hospital_users(user_id),
  access_action VARCHAR(20) NOT NULL DEFAULT 'VIEW',
  accessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT radiology_image_access_logs_action_check CHECK (
    access_action IN ('VIEW', 'DOWNLOAD')
  )
);

CREATE INDEX IF NOT EXISTS radiology_image_access_logs_image_idx
  ON public.radiology_image_access_logs(
    radiology_image_id,
    accessed_at DESC
  );
