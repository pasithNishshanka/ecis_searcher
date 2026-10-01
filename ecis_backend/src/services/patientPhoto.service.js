const crypto = require("node:crypto");
const pool = require("../config/database");

let schemaPromise;

function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.patient_identity_photos (
          patient_id BIGINT PRIMARY KEY REFERENCES public.patients(patient_id),
          hospital_id BIGINT NOT NULL REFERENCES public.hospitals(hospital_id),
          uploaded_by BIGINT NOT NULL REFERENCES public.hospital_users(user_id),
          ciphertext BYTEA NOT NULL,
          iv BYTEA NOT NULL,
          tag BYTEA NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.patient_identity_photo_events (
          event_id BIGSERIAL PRIMARY KEY,
          patient_id BIGINT NOT NULL REFERENCES public.patients(patient_id),
          hospital_id BIGINT NOT NULL REFERENCES public.hospitals(hospital_id),
          actor_user_id BIGINT NOT NULL REFERENCES public.hospital_users(user_id),
          event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('ADDED', 'REPLACED')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}

function encryptionKey() {
  const value = process.env.ECIS_FACE_TEMPLATE_KEY;
  const key = value && /^[0-9a-f]{64}$/i.test(value)
    ? Buffer.from(value, "hex")
    : value && Buffer.from(value, "base64");
  if (!key || key.length !== 32) {
    const error = new Error("Photo storage is unavailable until ECIS_FACE_TEMPLATE_KEY is configured as a 32-byte key.");
    error.statusCode = 503;
    error.expose = true;
    throw error;
  }
  return key;
}

function validatePhoto(photoBase64) {
  if (typeof photoBase64 !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(photoBase64)) {
    const error = new Error("A valid JPEG registration photo is required.");
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }
  const photo = Buffer.from(photoBase64, "base64");
  if (photo.length < 4 || photo.length > 1_000_000 || photo.toString("base64") !== photoBase64 ||
      photo[0] !== 0xff || photo[1] !== 0xd8 || photo[photo.length - 2] !== 0xff || photo[photo.length - 1] !== 0xd9) {
    const error = new Error("The registration photo must be a JPEG under 1 MB.");
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }
  return photo;
}

function encrypt(photo, patientId, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`${patientId}:registration-photo:v1`));
  return { ciphertext: Buffer.concat([cipher.update(photo), cipher.final()]), iv, tag: cipher.getAuthTag() };
}

function decrypt(row, key) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, row.iv);
  decipher.setAAD(Buffer.from(`${row.patient_id}:registration-photo:v1`));
  decipher.setAuthTag(row.tag);
  return Buffer.concat([decipher.update(row.ciphertext), decipher.final()]);
}

async function saveWithinTransaction(client, { patientId, hospitalId, userId, photoBase64 }) {
  const photo = validatePhoto(photoBase64);
  const key = encryptionKey();
  if (!Number.isSafeInteger(Number(userId)) || Number(userId) <= 0) {
    const error = new Error("An authenticated staff account is required to save a patient photo.");
    error.statusCode = 401;
    error.expose = true;
    throw error;
  }
  const existing = await client.query(
    "SELECT 1 FROM public.patient_identity_photos WHERE patient_id = $1", [patientId],
  );
  const encrypted = encrypt(photo, patientId, key);
  await client.query(`
    INSERT INTO public.patient_identity_photos
      (patient_id, hospital_id, uploaded_by, ciphertext, iv, tag)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (patient_id) DO UPDATE SET
      hospital_id = EXCLUDED.hospital_id,
      uploaded_by = EXCLUDED.uploaded_by,
      ciphertext = EXCLUDED.ciphertext,
      iv = EXCLUDED.iv,
      tag = EXCLUDED.tag,
      updated_at = NOW()
  `, [patientId, hospitalId, userId, encrypted.ciphertext, encrypted.iv, encrypted.tag]);
  await client.query(`
    INSERT INTO public.patient_identity_photo_events
      (patient_id, hospital_id, actor_user_id, event_type)
    VALUES ($1, $2, $3, $4)
  `, [patientId, hospitalId, userId, existing.rowCount ? "REPLACED" : "ADDED"]);
  return { replaced: Boolean(existing.rowCount) };
}

async function save({ patientId, hospitalId, userId, photoBase64 }) {
  validatePhoto(photoBase64);
  encryptionKey();
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const patient = await client.query(`
      SELECT p.patient_id FROM public.patients p
      WHERE p.patient_id = $1 AND p.status = 'ACTIVE'
        AND (p.hospital_id = $2 OR EXISTS (
          SELECT 1 FROM public.patient_hospital_registrations phr
          WHERE phr.patient_id = p.patient_id AND phr.hospital_id = $2 AND phr.status = 'ACTIVE'
        ))
      FOR UPDATE OF p
    `, [patientId, hospitalId]);
    if (!patient.rowCount) {
      const error = new Error("Patient is not registered at the active hospital.");
      error.statusCode = 404;
      error.expose = true;
      throw error;
    }
    const result = await saveWithinTransaction(client, { patientId, hospitalId, userId, photoBase64 });
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getPhoto({ patientId, hospitalId }) {
  const key = encryptionKey();
  await ensureSchema();
  const result = await pool.query(`
    SELECT ip.patient_id, ip.ciphertext, ip.iv, ip.tag
    FROM public.patient_identity_photos ip
    JOIN public.patients p ON p.patient_id = ip.patient_id
    WHERE ip.patient_id = $1 AND p.status = 'ACTIVE'
      AND (p.hospital_id = $2 OR EXISTS (
        SELECT 1 FROM public.patient_hospital_registrations phr
        WHERE phr.patient_id = p.patient_id AND phr.hospital_id = $2 AND phr.status = 'ACTIVE'
      ))
  `, [patientId, hospitalId]);
  return result.rowCount ? decrypt(result.rows[0], key) : null;
}

module.exports = { ensureSchema, validatePhoto, saveWithinTransaction, save, getPhoto };
