const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const pool = require("../src/config/database");
const faceProfiles = require("../src/services/faceProfile.service");
const ecisService = require("../src/services/ecis.service");
const { searchECISCandidates } = require("../src/controllers/ecis.controller");

const originalQuery = pool.query;
const originalFindMatches = faceProfiles.findMatches;
const originalSearch = ecisService.searchPatients;
after(() => {
  pool.query = originalQuery;
  faceProfiles.findMatches = originalFindMatches;
  ecisService.searchPatients = originalSearch;
});

test("ECIS face search logs only that a face clue was used and never logs the descriptor", async () => {
  const descriptor = Array(128).fill(0.01);
  const statements = [];
  pool.query = async (sql, params) => {
    statements.push({ sql: String(sql), params });
    return { rows: [], rowCount: 1 };
  };
  faceProfiles.findMatches = async () => [{ patientId: 42, distance: 0.2 }];
  ecisService.searchPatients = async (criteria) => {
    assert.deepEqual(criteria.facePatientIds, [42]);
    assert.equal(criteria.faceDescriptor, undefined);
    return { candidates: [{
      patient: { patientId: 42, hospitalId: 1, patientNumber: "P000042", firstName: "Test", lastName: "Person" },
      score: 0, normalizedScore: 0, evidence: [], sourceCounts: {},
    }] };
  };
  let response;
  const res = {
    status(code) { this.code = code; return this; },
    json(body) { response = body; return this; },
  };
  await searchECISCandidates({
    body: { faceDescriptor: descriptor, faceModelId: faceProfiles.MODEL_ID },
    user: { userId: 9, hospitalId: 1 },
  }, res);
  assert.equal(res.code, 200);
  assert.equal(response.candidates[0].evidence[0].key, "face");
  assert.equal(response.candidates[0].faceDistance, 0.2);
  const audit = statements.find(({ sql }) => sql.includes("INSERT INTO public.ecis_search_logs"));
  assert.ok(audit);
  assert.deepEqual(JSON.parse(audit.params[2]), { faceClueUsed: true });
  assert.equal(JSON.stringify(audit.params).includes("0.01"), false);
});
