const crypto = require("node:crypto");
const pool = require("../config/database");

const MODEL_ID = "face-api-1.7.15-ssd-68-recognition";
const DESCRIPTOR_LENGTH = 128;
// A conservative application threshold, not a validated clinical cutoff.
const MAX_DISTANCE = 0.55;

let schemaPromise;

function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
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
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.patient_face_profile_events (
          event_id BIGSERIAL PRIMARY KEY,
          patient_id BIGINT NOT NULL REFERENCES public.patients(patient_id),
          hospital_id BIGINT NOT NULL REFERENCES public.hospitals(hospital_id),
          actor_user_id BIGINT NOT NULL REFERENCES public.hospital_users(user_id),
          event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('ENROLLED', 'REPLACED', 'REMOVED')),
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
    const error = new Error("Face matching is unavailable until ECIS_FACE_TEMPLATE_KEY is configured as a 32-byte key.");
    error.statusCode = 503;
    error.expose = true;
    throw error;
  }
  return key;
}

function validateDescriptor(descriptor, modelId) {
  if (modelId !== MODEL_ID || !Array.isArray(descriptor) || descriptor.length !== DESCRIPTOR_LENGTH ||
    descriptor.some((value) => typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 10)) {
    const error = new Error("A valid face descriptor from the supported model is required.");
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }
  return descriptor;
}

function encrypt(descriptor, patientId, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`${patientId}:${MODEL_ID}`));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(descriptor), "utf8"), cipher.final()]);
  return { ciphertext, iv, tag: cipher.getAuthTag() };
}

function decrypt(row, key) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, row.descriptor_iv);
  decipher.setAAD(Buffer.from(`${row.patient_id}:${row.model_id}`));
  decipher.setAuthTag(row.descriptor_tag);
  const descriptor = JSON.parse(Buffer.concat([
    decipher.update(row.descriptor_ciphertext), decipher.final(),
  ]).toString("utf8"));
  return validateDescriptor(descriptor, row.model_id);
}

function distance(left, right) {
  let sum = 0;
  for (let index = 0; index < DESCRIPTOR_LENGTH; index += 1) {
    sum += (left[index] - right[index]) ** 2;
  }
  return Math.sqrt(sum);
}

async function enroll({ patientId, hospitalId, userId, descriptor, modelId, consent }) {
  const key = encryptionKey();
  validateDescriptor(descriptor, modelId);
  if (consent !== true) {
    const error = new Error("Documented patient consent is required for face enrollment.");
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const patient = await client.query(`
      SELECT p.patient_id
      FROM public.patients p
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
    const existed = await client.query(
      "SELECT 1 FROM public.patient_face_profiles WHERE patient_id = $1", [patientId],
    );
    const { ciphertext, iv, tag } = encrypt(descriptor, patientId, key);
    await client.query(`
      INSERT INTO public.patient_face_profiles
        (patient_id, enrolled_hospital_id, enrolled_by, model_id, descriptor_ciphertext,
         descriptor_iv, descriptor_tag, consent_recorded_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (patient_id) DO UPDATE SET
        enrolled_hospital_id = EXCLUDED.enrolled_hospital_id,
        enrolled_by = EXCLUDED.enrolled_by,
        model_id = EXCLUDED.model_id,
        descriptor_ciphertext = EXCLUDED.descriptor_ciphertext,
        descriptor_iv = EXCLUDED.descriptor_iv,
        descriptor_tag = EXCLUDED.descriptor_tag,
        consent_recorded_at = NOW(), updated_at = NOW()
    `, [patientId, hospitalId, userId, MODEL_ID, ciphertext, iv, tag]);
    await client.query(`
      INSERT INTO public.patient_face_profile_events (patient_id, hospital_id, actor_user_id, event_type)
      VALUES ($1, $2, $3, $4)
    `, [patientId, hospitalId, userId, existed.rowCount ? "REPLACED" : "ENROLLED"]);
    await client.query("COMMIT");
    return { replaced: Boolean(existed.rowCount) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function remove({ patientId, hospitalId, userId }) {
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`
      DELETE FROM public.patient_face_profiles fp
      USING public.patients p
      WHERE fp.patient_id = p.patient_id AND fp.patient_id = $1
        AND (p.hospital_id = $2 OR EXISTS (
          SELECT 1 FROM public.patient_hospital_registrations phr
          WHERE phr.patient_id = p.patient_id AND phr.hospital_id = $2 AND phr.status = 'ACTIVE'
        ))
      RETURNING fp.patient_id
    `, [patientId, hospitalId]);
    if (result.rowCount) {
      await client.query(`
        INSERT INTO public.patient_face_profile_events (patient_id, hospital_id, actor_user_id, event_type)
        VALUES ($1, $2, $3, 'REMOVED')
      `, [patientId, hospitalId, userId]);
    }
    await client.query("COMMIT");
    return Boolean(result.rowCount);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function status({ patientId, hospitalId }) {
  await ensureSchema();
  const result = await pool.query(`
    SELECT fp.updated_at
    FROM public.patient_face_profiles fp
    JOIN public.patients p ON p.patient_id = fp.patient_id
    WHERE fp.patient_id = $1 AND
      (p.hospital_id = $2 OR EXISTS (
        SELECT 1 FROM public.patient_hospital_registrations phr
        WHERE phr.patient_id = p.patient_id AND phr.hospital_id = $2 AND phr.status = 'ACTIVE'
      ))
  `, [patientId, hospitalId]);
  return { enrolled: Boolean(result.rowCount), updatedAt: result.rows[0]?.updated_at || null };
}

async function findMatches(descriptor, modelId) {
  const key = encryptionKey();
  validateDescriptor(descriptor, modelId);
  await ensureSchema();
  const result = await pool.query(`
    SELECT fp.patient_id, fp.model_id, fp.descriptor_ciphertext, fp.descriptor_iv, fp.descriptor_tag
    FROM public.patient_face_profiles fp
    JOIN public.patients p ON p.patient_id = fp.patient_id
    WHERE p.status = 'ACTIVE' AND fp.model_id = $1
  `, [MODEL_ID]);
  const matches = [];
  for (const row of result.rows) {
    // A corrupt template must not silently become a weak match.
    const value = distance(descriptor, decrypt(row, key));
    if (value <= MAX_DISTANCE) {
      matches.push({ patientId: Number(row.patient_id), distance: value });
    }
  }
  return matches.sort((a, b) => a.distance - b.distance).slice(0, 10);
}

module.exports = { MODEL_ID, MAX_DISTANCE, validateDescriptor, distance, enroll, remove, status, findMatches };
