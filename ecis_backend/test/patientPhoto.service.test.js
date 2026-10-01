const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const pool = require("../src/config/database");
const photos = require("../src/services/patientPhoto.service");

const originalQuery = pool.query;
const originalConnect = pool.connect;
const originalKey = process.env.ECIS_FACE_TEMPLATE_KEY;
after(() => {
  pool.query = originalQuery;
  pool.connect = originalConnect;
  if (originalKey === undefined) delete process.env.ECIS_FACE_TEMPLATE_KEY;
  else process.env.ECIS_FACE_TEMPLATE_KEY = originalKey;
});

const sample = Buffer.from([0xff, 0xd8, ...Array(100).fill(0x41), 0xff, 0xd9]);

test("registration photos require canonical JPEG input", () => {
  assert.deepEqual(photos.validatePhoto(sample.toString("base64")), sample);
  assert.throws(() => photos.validatePhoto("not-an-image"), /valid JPEG/);
  assert.throws(() => photos.validatePhoto(Buffer.from("text").toString("base64")), /must be a JPEG/);
});

test("photo save encrypts bytes and retrieval is hospital scoped", async () => {
  process.env.ECIS_FACE_TEMPLATE_KEY = "b".repeat(64);
  let stored;
  pool.query = async (sql, params) => {
    if (String(sql).includes("CREATE TABLE")) return { rows: [], rowCount: 0 };
    if (String(sql).includes("FROM public.patient_identity_photos ip")) {
      if (params[1] !== 1) return { rows: [], rowCount: 0 };
      return { rows: [{ patient_id: 42, ciphertext: stored[3], iv: stored[4], tag: stored[5] }], rowCount: 1 };
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  pool.connect = async () => ({
    async query(sql, params) {
      const query = String(sql).trim();
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(query)) return { rows: [], rowCount: 0 };
      if (query.includes("FROM public.patients p")) return { rows: [{ patient_id: 42 }], rowCount: 1 };
      if (query.startsWith("SELECT 1 FROM public.patient_identity_photos")) return { rows: [], rowCount: 0 };
      if (query.startsWith("INSERT INTO public.patient_identity_photos")) {
        stored = params;
        return { rows: [], rowCount: 1 };
      }
      if (query.startsWith("INSERT INTO public.patient_identity_photo_events")) return { rows: [], rowCount: 1 };
      throw new Error(`Unexpected query: ${query}`);
    },
    release() {},
  });

  assert.deepEqual(await photos.save({ patientId: 42, hospitalId: 1, userId: 9,
    photoBase64: sample.toString("base64") }), { replaced: false });
  assert.equal(stored[3].includes(sample), false);
  assert.deepEqual(await photos.getPhoto({ patientId: 42, hospitalId: 1 }), sample);
  assert.equal(await photos.getPhoto({ patientId: 42, hospitalId: 2 }), null);
});

test("photo upload rejects a patient outside the active hospital", async () => {
  pool.connect = async () => ({
    async query(sql) {
      if (String(sql).includes("FROM public.patients p")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    },
    release() {},
  });
  await assert.rejects(photos.save({ patientId: 42, hospitalId: 2, userId: 9,
    photoBase64: sample.toString("base64") }), /not registered at the active hospital/);
});
