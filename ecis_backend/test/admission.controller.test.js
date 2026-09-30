const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const service = require("../src/services/admission.service");
const controller = require("../src/controllers/admission.controller");

const originals = {
  createAdmission: service.createAdmission,
  createEmergencyAdmission: service.createEmergencyAdmission,
  dischargeAdmission: service.dischargeAdmission,
};
after(() => Object.assign(service, originals));

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const admissionBody = { patientId: 10, wardId: 20, bedId: 30 };

test("ward admission requires an assigned doctor for a non-doctor actor", async () => {
  let called = false;
  service.createAdmission = async () => { called = true; };
  const res = response();
  await controller.createAdmission({ user: { userId: 4, hospitalId: 1, role: "NURSE" }, body: admissionBody }, res, assert.ifError);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /attending doctor/i);
  assert.equal(called, false);
});

test("doctor admission uses authenticated identity and ignores client admission number", async () => {
  let submitted;
  service.createAdmission = async (input) => { submitted = input; return { admission: { admissionId: 42 } }; };
  const res = response();
  await controller.createAdmission({
    user: { userId: 7, hospitalId: 1, role: "DOCTOR" },
    body: { ...admissionBody, admissionNumber: "CLIENT-FORGED", attendingDoctorId: 99 },
  }, res, assert.ifError);
  assert.equal(res.statusCode, 201);
  assert.equal(submitted.actorUserId, 7);
  assert.equal(submitted.attendingDoctorId, 7);
  assert.equal(Object.hasOwn(submitted, "admissionNumber"), false);
});

test("emergency admission requires a selected doctor for a non-doctor actor", async () => {
  let called = false;
  service.createEmergencyAdmission = async () => { called = true; };
  const res = response();
  await controller.createEmergencyAdmission({
    user: { userId: 4, hospitalId: 1, role: "NURSE" },
    params: { emergencyCaseId: "5" },
    body: { wardId: 20, bedId: 30 },
  }, res, assert.ifError);
  assert.equal(res.statusCode, 400);
  assert.equal(called, false);
});

test("discharge forwards the authenticated actor for its audit entry", async () => {
  let submitted;
  service.dischargeAdmission = async (input) => { submitted = input; return { admission: {} }; };
  const res = response();
  await controller.dischargeAdmission({
    user: { userId: 7, hospitalId: 1, role: "DOCTOR" },
    params: { admissionId: "42" },
    body: { dischargeDiagnosis: "Resolved", dischargeSummary: "Discharged home" },
  }, res, assert.ifError);
  assert.equal(res.statusCode, 200);
  assert.equal(submitted.actorUserId, 7);
  assert.equal(submitted.hospitalId, 1);
});
