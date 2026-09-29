const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const { authorizeRoles } = require("../src/middleware/authorization.middleware");
const { hasLocalSystemAdminAccess } = require("../src/config/localAccess");

const originalNodeEnv = process.env.NODE_ENV;
const originalFullAccess = process.env.ECIS_EXAM_FULL_ACCESS;

after(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalFullAccess === undefined) delete process.env.ECIS_EXAM_FULL_ACCESS;
  else process.env.ECIS_EXAM_FULL_ACCESS = originalFullAccess;
});

function checkRole(role) {
  let status;
  let passed = false;
  const response = {
    status(value) {
      status = value;
      return this;
    },
    json() {
      return this;
    },
  };
  authorizeRoles("DOCTOR")({ user: role ? { role } : null }, response, () => {
    passed = true;
  });
  return { status, passed };
}

test("local access is opt-in and only for an authenticated system administrator", () => {
  process.env.NODE_ENV = "development";
  delete process.env.ECIS_EXAM_FULL_ACCESS;
  assert.equal(hasLocalSystemAdminAccess("SYSTEM_ADMIN"), false);
  assert.deepEqual(checkRole("SYSTEM_ADMIN"), { status: 403, passed: false });

  process.env.ECIS_EXAM_FULL_ACCESS = "true";
  assert.deepEqual(checkRole("SYSTEM_ADMIN"), { status: undefined, passed: true });
  assert.deepEqual(checkRole("NURSE"), { status: 403, passed: false });
  assert.deepEqual(checkRole(null), { status: 401, passed: false });
});

test("local access cannot bypass production authorization", () => {
  process.env.NODE_ENV = "production";
  process.env.ECIS_EXAM_FULL_ACCESS = "true";
  assert.equal(hasLocalSystemAdminAccess("SYSTEM_ADMIN"), false);
  assert.deepEqual(checkRole("SYSTEM_ADMIN"), { status: 403, passed: false });
  assert.deepEqual(checkRole("DOCTOR"), { status: undefined, passed: true });
});
