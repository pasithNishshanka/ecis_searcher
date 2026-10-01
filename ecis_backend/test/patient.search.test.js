const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const pool = require("../src/config/database");
const patientService = require("../src/services/patient.service");
const { searchPatients } = require("../src/controllers/patient.controller");

const originalQuery = pool.query;
const originalSearch = patientService.searchPatients;
after(() => {
  pool.query = originalQuery;
  patientService.searchPatients = originalSearch;
});

test("patient registry search applies text and gender filters in PostgreSQL", async () => {
  const captured = [];
  pool.query = async (sql, params) => {
    captured.push({ sql: String(sql), params });
    return { rows: String(sql).includes("COUNT(DISTINCT") ? [{ total: 113 }] : [] };
  };
  const result = await originalSearch(1, "Perera", "Female", 2);
  assert.equal(result.total, 113);
  assert.equal(result.page, 2);
  assert.deepEqual(captured[0].params, [1, "%Perera%", "Female"]);
  assert.deepEqual(captured[1].params, [1, "%Perera%", "Female", 50, 50]);
  assert.match(captured[1].sql, /p\.gender = \$3/);
  assert.match(captured[1].sql, /p\.first_name ILIKE \$2/);
  assert.match(captured[1].sql, /CONCAT_WS\(' ', p\.first_name, p\.middle_name, p\.last_name\) ILIKE \$2/);
  assert.match(captured[1].sql, /phr\.hospital_id = \$1/);
});

test("gender-only registry search is accepted and scoped to the signed-in hospital", async () => {
  let args;
  patientService.searchPatients = async (...values) => {
    args = values;
    return { rows: [{ patient_id: 2 }], total: 113, page: 1, pageSize: 50 };
  };
  let response;
  const res = {
    status(code) { this.code = code; return this; },
    json(body) { response = body; return this; },
  };
  await searchPatients({ user: { hospitalId: 3 }, query: { gender: "Female" } }, res, () => {});
  assert.equal(res.code, 200);
  assert.deepEqual(args, [3, "", "Female", 1]);
  assert.equal(response.count, 1);
  assert.equal(response.total, 113);
  assert.equal(response.hasMore, true);
});

test("patient search rejects an invalid page", async () => {
  let response;
  const res = { status(code) { this.code = code; return this; }, json(body) { response = body; return this; } };
  await searchPatients({ user: { hospitalId: 3 }, query: { q: "Perera", page: "0" } }, res, () => {});
  assert.equal(res.code, 400);
  assert.match(response.message, /Page/);
});
