const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const service = require("../src/services/emergency.service");
const controller = require("../src/controllers/emergency.controller");

const originalCreate = service.createEmergencyCase;
after(() => { service.createEmergencyCase = originalCreate; });

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const body = { caseNumber: "CASE-TEST", unidentifiedPatient: true };

test("full-access administrator is not mislabeled as an assigned doctor", async () => {
  let submitted;
  service.createEmergencyCase = async (input) => { submitted = input; return {}; };
  const res = response();
  await controller.createEmergencyCase({
    user: { userId: 4, hospitalId: 1, role: "SYSTEM_ADMIN" }, body,
  }, res, assert.ifError);
  assert.equal(res.statusCode, 201);
  assert.equal(submitted.assignedDoctorId, null);
});

test("doctor case creation attributes the authenticated doctor", async () => {
  let submitted;
  service.createEmergencyCase = async (input) => { submitted = input; return {}; };
  const res = response();
  await controller.createEmergencyCase({
    user: { userId: 9, hospitalId: 3, role: "DOCTOR" },
    body: { ...body, assignedDoctorId: 4 },
  }, res, assert.ifError);
  assert.equal(res.statusCode, 201);
  assert.equal(submitted.assignedDoctorId, 9);
});
