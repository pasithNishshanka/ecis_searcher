const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const service = require("../src/services/patient.service");
const { createPatient } = require("../src/controllers/patient.controller");

const originalCreate = service.createPatient;
after(() => { service.createPatient = originalCreate; });

async function registrationError(message, code) {
  service.createPatient = async () => {
    const error = new Error(message);
    if (code) error.code = code;
    throw error;
  };
  let passedError;
  await createPatient({ user: { hospitalId: 1, userId: 9 }, body: {} }, {}, (error) => {
    passedError = error;
  });
  return passedError;
}

test("duplicate NIC is a useful conflict, not a 500", async () => {
  const error = await registrationError("A patient with this NIC already exists.");
  assert.equal(error.statusCode, 409);
  assert.equal(error.expose, true);
  assert.match(error.message, /Find existing patient/);
});

test("invalid registration input is a 400 with the validation message", async () => {
  const error = await registrationError("District does not belong to the selected province.");
  assert.equal(error.statusCode, 400);
  assert.equal(error.expose, true);
});

test("unexpected registration faults remain internal errors", async () => {
  const error = await registrationError("Unexpected database failure");
  assert.equal(error.statusCode, undefined);
  assert.equal(error.expose, undefined);
});
