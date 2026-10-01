const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const pool = require("../src/config/database");
const ecisService = require("../src/services/ecis.service");

const originalQuery = pool.query;
after(() => { pool.query = originalQuery; });

test("face candidate retrieval scores clinical clues without using them as SQL gates", async () => {
  let captured;
  pool.query = async (sql, values) => {
    captured = { sql: String(sql), values };
    return { rows: [] };
  };
  const result = await ecisService.searchPatients(
    { name: "Perera", dental: "tooth 11 / crown", ageMin: 30 },
    1,
    { facePatientIds: [42], relaxedFilters: true },
  );
  const patientWhere = captured.sql.split("FROM public.patients p").at(-1);
  assert.deepEqual(captured.values, [1, [42]]);
  assert.match(patientWhere, /p\.patient_id = ANY\(\$2::BIGINT\[\]\)/);
  assert.match(patientWhere, /phr\.hospital_id = \$1/);
  assert.doesNotMatch(patientWhere, /p\.first_name/);
  assert.doesNotMatch(patientWhere, /FROM public\.dental_records dr/);
  assert.equal(result.searchCriteria.name, "perera");
  assert.equal(result.searchCriteria.dental, "tooth 11 / crown");
});

test("ordinary clinical search keeps its database filters", async () => {
  let captured;
  pool.query = async (sql, values) => {
    captured = { sql: String(sql), values };
    return { rows: [] };
  };
  await ecisService.searchPatients({ name: "Perera", dental: "crown" }, 1);
  const patientWhere = captured.sql.split("FROM public.patients p").at(-1);
  assert.deepEqual(captured.values, [1, "perera", "crown"]);
  assert.match(patientWhere, /phr\.hospital_id = \$1/);
  assert.match(patientWhere, /p\.first_name/);
  assert.match(patientWhere, /FROM public\.dental_records dr/);
});

test("case-linked search may retrieve cross-hospital candidates", async () => {
  let captured;
  pool.query = async (sql, values) => {
    captured = { sql: String(sql), values };
    return { rows: [] };
  };
  await ecisService.searchPatients({ bloodGroup: "O+" }, 1, { allowCrossHospital: true });
  const patientWhere = captured.sql.split("FROM public.patients p").at(-1);
  assert.deepEqual(captured.values, ["o+"]);
  assert.doesNotMatch(patientWhere, /phr\.hospital_id/);
});

test("ECIS ranks every database match before returning the best 50", async () => {
  let sqlText;
  pool.query = async (sql) => {
    sqlText = String(sql);
    return { rows: Array.from({ length: 60 }, (_, index) => ({
      patient_id: index + 1,
      patient_number: index === 59 ? "A000001" : `P${String(index + 1).padStart(6, "0")}`,
      gender: "Male",
      surgeries: [], fractures: [], devices: [], dental_records: [],
      observations: [], treatments: [], investigations: [],
    })) };
  };
  const result = await ecisService.searchPatients({ gender: "Male" }, 1);
  assert.doesNotMatch(sqlText.split("FROM public.patients p").at(-1), /LIMIT 50/);
  assert.equal(result.totalCandidates, 60);
  assert.equal(result.candidates.length, 50);
  assert.equal(result.candidates[0].patient.patientNumber, "A000001");
});
