const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const pool = require("../src/config/database");
const faceProfiles = require("../src/services/faceProfile.service");

const originalQuery = pool.query;
const originalConnect = pool.connect;
const originalKey = process.env.ECIS_FACE_TEMPLATE_KEY;
after(() => {
  pool.query = originalQuery;
  pool.connect = originalConnect;
  if (originalKey === undefined) delete process.env.ECIS_FACE_TEMPLATE_KEY;
  else process.env.ECIS_FACE_TEMPLATE_KEY = originalKey;
});

test("face descriptors require the expected model and 128 finite values", () => {
  const descriptor = Array(128).fill(0.01);
  assert.equal(faceProfiles.validateDescriptor(descriptor, faceProfiles.MODEL_ID), descriptor);
  assert.throws(() => faceProfiles.validateDescriptor([1], faceProfiles.MODEL_ID), /valid face descriptor/);
  assert.throws(() => faceProfiles.validateDescriptor(descriptor, "other-model"), /valid face descriptor/);
  assert.throws(() => faceProfiles.validateDescriptor([...descriptor.slice(0, 127), Infinity], faceProfiles.MODEL_ID), /valid face descriptor/);
});

test("face enrollment encrypts the template and search returns only nearby candidates", async () => {
  process.env.ECIS_FACE_TEMPLATE_KEY = "a".repeat(64);
  const descriptor = Array(128).fill(0.01);
  const photo = Buffer.from([0xff, 0xd8, ...Array(100).fill(0x41), 0xff, 0xd9]);
  let stored;
  pool.query = async (sql, params) => {
    if (String(sql).includes("CREATE TABLE") || String(sql).includes("ALTER TABLE")) return { rows: [], rowCount: 0 };
    if (String(sql).includes("fp.photo_ciphertext")) {
      if (params[1] !== 1) return { rows: [], rowCount: 0 };
      return { rows: [{ patient_id: 42, photo_ciphertext: stored[7], photo_iv: stored[8], photo_tag: stored[9] }], rowCount: 1 };
    }
    if (String(sql).includes("FROM public.patient_face_profiles fp")) {
      return { rows: [{ patient_id: 42, model_id: faceProfiles.MODEL_ID,
        descriptor_ciphertext: stored[4], descriptor_iv: stored[5], descriptor_tag: stored[6] }], rowCount: 1 };
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  pool.connect = async () => ({
    async query(sql, params) {
      const query = String(sql).trim();
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(query)) return { rows: [], rowCount: 0 };
      if (query.includes("FROM public.patients p")) return { rows: [{ patient_id: 42 }], rowCount: 1 };
      if (query.startsWith("SELECT 1 FROM public.patient_face_profiles")) return { rows: [], rowCount: 0 };
      if (query.startsWith("INSERT INTO public.patient_face_profiles")) {
        stored = params;
        return { rows: [], rowCount: 1 };
      }
      if (query.startsWith("INSERT INTO public.patient_face_profile_events")) return { rows: [], rowCount: 1 };
      throw new Error(`Unexpected query: ${query}`);
    },
    release() {},
  });

  await faceProfiles.enroll({ patientId: 42, hospitalId: 1, userId: 9,
    descriptor, modelId: faceProfiles.MODEL_ID, photoBase64: photo.toString("base64"), consent: true });
  assert.equal(stored[4].includes(Buffer.from(JSON.stringify(descriptor))), false);
  assert.equal(stored[7].includes(photo), false);
  assert.deepEqual(await faceProfiles.getPhoto({ patientId: 42, hospitalId: 1 }), photo);
  assert.equal(await faceProfiles.getPhoto({ patientId: 42, hospitalId: 2 }), null);
  assert.deepEqual(await faceProfiles.findMatches(descriptor, faceProfiles.MODEL_ID), [
    { patientId: 42, distance: 0 },
  ]);
  assert.deepEqual(await faceProfiles.findMatches(Array(128).fill(1), faceProfiles.MODEL_ID), []);
});

test("face enrollment requires explicit consent", async () => {
  process.env.ECIS_FACE_TEMPLATE_KEY = "a".repeat(64);
  await assert.rejects(faceProfiles.enroll({ patientId: 42, hospitalId: 1, userId: 9,
    descriptor: Array(128).fill(0), modelId: faceProfiles.MODEL_ID,
    photoBase64: Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64"), consent: false }), /consent/);
});

test("registration photo input requires a canonical JPEG within the size limit", () => {
  assert.throws(() => faceProfiles.validatePhoto("not-an-image"), /valid JPEG/);
  assert.throws(() => faceProfiles.validatePhoto(Buffer.from("hello").toString("base64")), /must be a JPEG/);
  assert.throws(() => faceProfiles.validatePhoto(Buffer.concat([
    Buffer.from([0xff, 0xd8]), Buffer.alloc(1_000_000), Buffer.from([0xff, 0xd9]),
  ]).toString("base64")), /under 1 MB/);
});
