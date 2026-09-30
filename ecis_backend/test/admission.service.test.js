const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const pool = require("../src/config/database");
const { dischargeAdmission } = require("../src/services/admission.service");

const originalConnect = pool.connect;
after(() => { pool.connect = originalConnect; });

test("discharge accepts an ADMITTED encounter and closes it with the admission", async () => {
  const statements = [];
  const admission = {
    admission_id: 11, patient_id: 22, encounter_id: 33,
    ward_id: 44, bed_id: 55, status: "ADMITTED",
  };
  const client = {
    async query(sql) {
      const statement = String(sql).trim().replace(/\s+/g, " ");
      statements.push(statement);
      if (statement === "BEGIN" || statement === "COMMIT") return { rowCount: 0, rows: [] };
      if (statement.includes("FROM public.admissions a")) return { rowCount: 1, rows: [admission] };
      if (statement.includes("FROM public.beds")) return { rowCount: 1, rows: [{ bed_id: 55, ward_id: 44, status: "OCCUPIED" }] };
      if (statement.includes("FROM public.encounters")) return { rowCount: 1, rows: [{ encounter_id: 33, patient_id: 22, hospital_id: 1, status: "ADMITTED" }] };
      if (statement.includes("FROM public.emergency_cases")) return { rowCount: 0, rows: [] };
      if (statement.includes("UPDATE public.admissions")) return { rowCount: 1, rows: [{ ...admission, status: "DISCHARGED" }] };
      if (statement.includes("UPDATE public.encounters")) return { rowCount: 1, rows: [] };
      if (statement.includes("UPDATE public.beds")) return { rowCount: 1, rows: [{ bed_id: 55, status: "AVAILABLE" }] };
      if (statement.includes("INSERT INTO public.audit_logs")) return { rowCount: 1, rows: [] };
      throw new Error(`Unexpected SQL: ${statement}`);
    },
    release() {},
  };
  pool.connect = async () => client;

  const result = await dischargeAdmission({
    hospitalId: 1, admissionId: 11, actorUserId: 4,
    dischargeDiagnosis: "Resolved", dischargeSummary: "Discharged home",
  });
  assert.equal(result.admission.status, "DISCHARGED");
  assert.equal(result.encounter.status, "COMPLETED");
  assert.equal(result.bed.status, "AVAILABLE");
  assert.ok(statements.some((sql) => sql.includes("UPDATE public.encounters")));
  assert.equal(statements.at(-1), "COMMIT");
});
