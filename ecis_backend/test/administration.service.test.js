const assert = require("node:assert/strict");
const { after, test } = require("node:test");

const pool = require("../src/config/database");
const { createHospital, createStaffAccount, createOrUpdateAssignment, searchStaff } = require("../src/services/administration.service");

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
      if (statement.includes("next_clinician_number")) return { rows: [{ next_clinician_number: "2" }], rowCount: 1 };
      if (statement.includes("next_number")) return { rows: [{ next_number: "42" }], rowCount: 1 };
      if (statement.startsWith("INSERT INTO public.hospital_users")) {
        assert.equal(params[1], "EMP-000042");
        assert.equal(params[9], "ECIS-CLIN-0002");
        return { rows: [{ user_id: 12, employee_number: params[1], internal_clinician_id: params[9], full_name: params[2], username: params[3], role: params[5], department: params[6], hospital_id: params[0] }], rowCount: 1 };
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
  assert.equal(staff.internalClinicianId, "ECIS-CLIN-0002");
  assert.equal(staff.licenseNumber, "SLMC 12345");
  assert.equal(staff.designation, null);
  assert.ok(statements.findIndex(({ statement }) => statement.includes("pg_advisory_xact_lock")) < statements.findIndex(({ statement }) => statement.includes("next_number")));
  assert.equal(statements.at(-1).statement, "COMMIT");
});

test("hospital creation rejects a district outside the chosen province", async () => {
  pool.query = async () => { throw new Error("Invalid location should not reach the database"); };
  await assert.rejects(createHospital({ hospitalName: "Test Hospital", province: "Western Province", district: "Kandy" }), /valid Sri Lankan location pair/);
});

function mockHospitalCreation({ existingCodes = [], duplicateName = false } = {}) {
  const statements = [];
  pool.connect = async () => ({
    async query(sql, params) {
      const statement = String(sql).trim().replace(/\s+/g, " ");
      statements.push({ statement, params });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(statement)) return { rows: [], rowCount: 0 };
      if (statement.includes("pg_advisory_xact_lock")) return { rows: [{}], rowCount: 1 };
      if (statement.includes("LOWER(hospital_name)")) return { rows: duplicateName ? [{ hospital_id: 1 }] : [], rowCount: duplicateName ? 1 : 0 };
      if (statement.includes("SELECT hospital_code FROM public.hospitals")) {
        return { rows: existingCodes.map((hospital_code) => ({ hospital_code })), rowCount: existingCodes.length };
      }
      if (statement.startsWith("INSERT INTO public.hospitals")) {
        return { rows: [{ hospital_id: 11, hospital_code: params[0], hospital_name: params[1], hospital_type: params[2], province: params[3], district: params[4], address: params[5], phone: params[6], email: params[7], is_active: true }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${statement}`);
    },
    release() {},
  });
  return statements;
}

test("hospital code is derived from the name, not a client-supplied code", async () => {
  const statements = mockHospitalCreation();
  const hospital = await createHospital({ hospitalCode: "WRONG", hospitalName: "District General Hospital Kandy", province: "Central Province", district: "Kandy" });
  assert.equal(hospital.hospitalCode, "DGHK");
  assert.equal(statements.at(-1).statement, "COMMIT");
});

test("hospital code adds a suffix when the name-derived code already exists", async () => {
  mockHospitalCreation({ existingCodes: ["DGHK", "DGHK-2"] });
  const hospital = await createHospital({ hospitalName: "District General Hospital Kandy", province: "Central Province", district: "Kandy" });
  assert.equal(hospital.hospitalCode, "DGHK-3");
});

test("duplicate hospital names roll back before inserting", async () => {
  const statements = mockHospitalCreation({ duplicateName: true });
  await assert.rejects(createHospital({ hospitalName: "District General Hospital Kandy" }), /already uses this name/);
  assert.equal(statements.at(-1).statement, "ROLLBACK");
  assert.ok(!statements.some(({ statement }) => statement.startsWith("INSERT INTO public.hospitals")));
});

test("first clinical assignment gives existing staff an internal clinician ID", async () => {
  const statements = [];
  pool.connect = async () => ({
    async query(sql, params) {
      const statement = String(sql).trim().replace(/\s+/g, " ");
      statements.push({ statement, params });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(statement)) return { rows: [], rowCount: 0 };
      if (statement.includes("FROM public.hospital_users") && statement.includes("FOR UPDATE")) {
        return { rows: [{ user_id: 20, internal_clinician_id: null }], rowCount: 1 };
      }
      if (statement.includes("FROM public.hospitals")) return { rows: [{ hospital_id: 1 }], rowCount: 1 };
      if (statement.includes("pg_advisory_xact_lock")) return { rows: [{}], rowCount: 1 };
      if (statement.includes("next_clinician_number")) return { rows: [{ next_clinician_number: "3" }], rowCount: 1 };
      if (statement.startsWith("UPDATE public.hospital_users")) {
        assert.deepEqual(params, ["ECIS-CLIN-0003", 20]);
        return { rows: [], rowCount: 1 };
      }
      if (statement.includes("FROM public.hospital_user_assignments")) return { rows: [], rowCount: 0 };
      if (statement.startsWith("INSERT INTO public.hospital_user_assignments")) {
        return { rows: [{ assignment_id: 19, user_id: 20, hospital_id: 1, role: "DOCTOR", department: "OPD", designation: "Medical Officer", license_number: null, start_date: "2026-10-01", end_date: null, status: "ACTIVE" }], rowCount: 1 };
      }
      if (statement.startsWith("INSERT INTO public.audit_logs")) return { rows: [], rowCount: 1 };
      throw new Error(`Unexpected SQL: ${statement}`);
    },
    release() {},
  });

  const assignment = await createOrUpdateAssignment({
    actor: { role: "SYSTEM_ADMIN", hospitalId: 1, userId: 4 },
    input: { userId: 20, hospitalId: 1, role: "DOCTOR", department: "OPD", designation: "Medical Officer", startDate: "2026-10-01" },
  });

  assert.equal(assignment.internalClinicianId, "ECIS-CLIN-0003");
  assert.equal(statements.at(-1).statement, "COMMIT");
});

test("staff search returns on-file designation and license for assignment prefill", async () => {
  pool.query = async (sql, params) => {
    assert.match(sql, /LEFT JOIN LATERAL/);
    assert.deepEqual(params, ["%doctor%"]);
    return {
      rows: [{ user_id: 9, employee_number: "DOC-001", internal_clinician_id: "ECIS-CLIN-0001", full_name: "Doctor Example", username: "doctor.example", account_role: "DOCTOR", account_department: "OPD", home_hospital_id: 1, home_hospital_name: "General Hospital", designation: "Medical Officer", license_number: "SLMC-12345" }],
      rowCount: 1,
    };
  };
  const [staff] = await searchStaff("doctor");
  assert.equal(staff.internalClinicianId, "ECIS-CLIN-0001");
  assert.equal(staff.designation, "Medical Officer");
  assert.equal(staff.licenseNumber, "SLMC-12345");
});
