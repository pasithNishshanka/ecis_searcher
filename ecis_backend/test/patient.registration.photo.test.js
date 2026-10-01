const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const pool = require("../src/config/database");
const patients = require("../src/services/patient.service");

const originalQuery = pool.query;
const originalConnect = pool.connect;
const originalKey = process.env.ECIS_FACE_TEMPLATE_KEY;
after(() => {
  pool.query = originalQuery;
  pool.connect = originalConnect;
  if (originalKey === undefined) delete process.env.ECIS_FACE_TEMPLATE_KEY;
  else process.env.ECIS_FACE_TEMPLATE_KEY = originalKey;
});

const photoBase64 = Buffer.from([0xff, 0xd8, ...Array(100).fill(0x41), 0xff, 0xd9]).toString("base64");
const registration = {
  hospitalId: 1,
  registeredBy: 9,
  firstName: "Test",
  lastName: "Patient",
  dateOfBirth: "1990-01-01",
  gender: "Male",
  province: "Western Province",
  district: "Colombo",
  allergyStatus: "NO_KNOWN_ALLERGIES",
  foodAllergies: [],
  medicalAllergies: [],
  photoBase64,
};

test("registration commits the captured photo with the new patient", async () => {
  process.env.ECIS_FACE_TEMPLATE_KEY = "c".repeat(64);
  const events = [];
  pool.query = async (sql) => {
    if (String(sql).includes("CREATE TABLE")) return { rows: [], rowCount: 0 };
    return { rows: [{ patient_id: 42 }], rowCount: 1 };
  };
  pool.connect = async () => ({
    async query(sql) {
      const statement = String(sql).trim();
      if (statement === "BEGIN" || statement === "COMMIT" || statement === "ROLLBACK") {
        events.push(statement);
        return { rows: [], rowCount: 0 };
      }
      if (statement.includes("FROM public.hospitals")) return { rows: [{}], rowCount: 1 };
      if (statement.includes("MAX(")) return { rows: [{ next_number: 3002 }], rowCount: 1 };
      if (statement.includes("INSERT INTO public.patients")) return { rows: [{ patient_id: 42 }], rowCount: 1 };
      if (statement.includes("INSERT INTO public.patient_identity_photos")) events.push("PHOTO_INSERT");
      if (statement.includes("INSERT INTO public.patient_identity_photo_events")) events.push("PHOTO_AUDIT");
      return { rows: [], rowCount: 0 };
    },
    release() {},
  });

  const patient = await patients.createPatient(registration);
  assert.equal(patient.patient_id, 42);
  assert.deepEqual(events, ["BEGIN", "PHOTO_INSERT", "PHOTO_AUDIT", "COMMIT"]);
});

test("registration rolls back the patient if saving its photo fails", async () => {
  process.env.ECIS_FACE_TEMPLATE_KEY = "c".repeat(64);
  const events = [];
  pool.connect = async () => ({
    async query(sql) {
      const statement = String(sql).trim();
      if (statement === "BEGIN" || statement === "COMMIT" || statement === "ROLLBACK") {
        events.push(statement);
        return { rows: [], rowCount: 0 };
      }
      if (statement.includes("FROM public.hospitals")) return { rows: [{}], rowCount: 1 };
      if (statement.includes("MAX(")) return { rows: [{ next_number: 3002 }], rowCount: 1 };
      if (statement.includes("INSERT INTO public.patients")) return { rows: [{ patient_id: 42 }], rowCount: 1 };
      if (statement.includes("INSERT INTO public.patient_identity_photos")) throw new Error("Photo storage failed");
      return { rows: [], rowCount: 0 };
    },
    release() {},
  });

  await assert.rejects(patients.createPatient(registration), /Photo storage failed/);
  assert.deepEqual(events, ["BEGIN", "ROLLBACK"]);
});
