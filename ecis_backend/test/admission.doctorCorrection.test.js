const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const pool = require("../src/config/database");
const admissionService = require("../src/services/admission.service");
const { assignAttendingDoctor } = require("../src/controllers/admission.controller");

const originalConnect = pool.connect;
const originalQuery = pool.query;
const originalAssign = admissionService.assignAttendingDoctor;
after(() => {
  pool.connect = originalConnect;
  pool.query = originalQuery;
  admissionService.assignAttendingDoctor = originalAssign;
});

test("an attending-doctor correction verifies the hospital assignment and writes an audit event", async () => {
  const statements = [];
  pool.connect = async () => ({
    async query(sql, params) {
      const text = String(sql);
      statements.push({ text, params });
      if (text.includes("SELECT a.admission_id, a.attending_doctor_id")) {
        return { rows: [{ admission_id: 12, attending_doctor_id: null }], rowCount: 1 };
      }
      if (text.includes("FROM public.hospital_users u")) {
        return { rows: [{ user_id: 7 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
    release() {},
  });
  pool.query = async () => ({ rows: [{ admission_id: 12, doctor_id: 7 }], rowCount: 1 });
  const result = await admissionService.assignAttendingDoctor({
    hospitalId: 1, admissionId: 12, doctorId: 7, actorUserId: 9,
    reason: "Verified from the signed admission record.",
  });
  assert.equal(result.doctor_id, 7);
  assert.deepEqual(statements.find((entry) => entry.text.includes("JOIN public.hospital_user_assignments"))?.params, [7, 1]);
  assert.ok(statements.some((entry) => entry.text.includes("UPDATE public.admissions SET attending_doctor_id")));
  const audit = statements.find((entry) => entry.text.includes("ADMISSION_ATTENDING_DOCTOR_ASSIGNED"));
  assert.equal(audit.params[0], 1);
  assert.equal(audit.params[1], 9);
  assert.match(JSON.parse(audit.params[3]).reason, /Verified/);
  assert.ok(statements.some((entry) => entry.text === "COMMIT"));
});

test("the correction refuses to overwrite an already assigned doctor", async () => {
  const statements = [];
  pool.connect = async () => ({
    async query(sql) {
      const text = String(sql);
      statements.push(text);
      if (text.includes("SELECT a.admission_id, a.attending_doctor_id")) {
        return { rows: [{ admission_id: 12, attending_doctor_id: 8 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
    release() {},
  });
  await assert.rejects(admissionService.assignAttendingDoctor({
    hospitalId: 1, admissionId: 12, doctorId: 7, actorUserId: 9,
    reason: "Verified from the signed admission record.",
  }), /already recorded/);
  assert.ok(statements.includes("ROLLBACK"));
  assert.equal(statements.some((item) => item.includes("UPDATE public.admissions")), false);
});

test("the controller requires a documented reason", async () => {
  let response;
  const res = { status(code) { this.code = code; return this; }, json(body) { response = body; return this; } };
  await assignAttendingDoctor({
    user: { hospitalId: 1, userId: 9 }, params: { admissionId: "12" },
    body: { doctorId: 7, reason: "short" },
  }, res, () => {});
  assert.equal(res.code, 400);
  assert.match(response.message, /Explain/);
});
