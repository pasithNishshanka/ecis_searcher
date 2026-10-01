const assert = require("node:assert/strict");
const { after, test } = require("node:test");

const pool = require("../src/config/database");
const { createHospital, createStaffAccount } = require("../src/services/administration.service");

const originalConnect = pool.connect;
const originalQuery = pool.query;
after(() => {
  pool.connect = originalConnect;
  pool.query = originalQuery;
});

test("staff creation assigns the next employee number from the database", async () => {
  const statements = [];
  pool.connect = async () => ({
    async query(sql, params) {
      const statement = String(sql).trim().replace(/\s+/g, " ");
      statements.push({ statement, params });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(statement)) return { rows: [], rowCount: 0 };
      if (statement.includes("FROM public.hospitals")) return { rows: [{ hospital_id: 1, hospital_name: "General Hospital" }], rowCount: 1 };
      if (statement.includes("WHERE LOWER(username)")) return { rows: [], rowCount: 0 };
      if (statement.includes("pg_advisory_xact_lock")) return { rows: [{}], rowCount: 1 };
      if (statement.includes("next_number")) return { rows: [{ next_number: "42" }], rowCount: 1 };
      if (statement.startsWith("INSERT INTO public.hospital_users")) {
        assert.equal(params[1], "EMP-000042");
        return { rows: [{ user_id: 12, employee_number: params[1], full_name: params[2], username: params[3], role: params[5], department: params[6], hospital_id: params[0] }], rowCount: 1 };
      }
      if (statement.startsWith("INSERT INTO public.hospital_user_assignments")) return { rows: [], rowCount: 1 };
      throw new Error(`Unexpected SQL: ${statement}`);
    },
    release() {},
  });

  const staff = await createStaffAccount({
    actor: { role: "SYSTEM_ADMIN", hospitalId: 1 },
    input: { hospitalId: 1, role: "DOCTOR", employeeNumber: "SLMC 12345", fullName: "Test Clinician", username: "test.clinician", password: "a-secure-password", department: "OPD", licenseNumber: "SLMC 12345" },
  });

  assert.equal(staff.employeeNumber, "EMP-000042");
  assert.ok(statements.findIndex(({ statement }) => statement.includes("pg_advisory_xact_lock")) < statements.findIndex(({ statement }) => statement.includes("next_number")));
  assert.equal(statements.at(-1).statement, "COMMIT");
});

test("hospital creation rejects a district outside the chosen province", async () => {
  pool.query = async () => { throw new Error("Invalid location should not reach the database"); };
  await assert.rejects(createHospital({ hospitalCode: "TEST", hospitalName: "Test Hospital", province: "Western Province", district: "Kandy" }), /valid Sri Lankan location pair/);
});
