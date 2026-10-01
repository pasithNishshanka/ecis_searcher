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

function patient(patientId, score = 0) {
  return {
    patient: {
      patientId, hospitalId: 1, patientNumber: `P${String(patientId).padStart(6, "0")}`,
      firstName: "Test", lastName: "Person",
    },
    score, normalizedScore: score, evidence: [], sourceCounts: {},
  };
}

async function search(body) {
  let response;
  const res = {
    status(code) { this.code = code; return this; },
    json(value) { response = value; return this; },
  };
  await searchECISCandidates({ body, user: { userId: 9, hospitalId: 1 } }, res);
  return { status: res.code, body: response };
}

test("face-only search uses server-computed IDs, scores similarity, and never audits the descriptor", async () => {
  const descriptor = Array(128).fill(0.01);
  const statements = [];
  pool.query = async (sql, params) => {
    statements.push({ sql: String(sql), params });
    return { rows: [], rowCount: 1 };
  };
  faceProfiles.findMatches = async (_descriptor, _modelId, hospitalId) => {
    assert.equal(hospitalId, 1);
    return [{ patientId: 42, distance: 0.2 }];
  };
  ecisService.searchPatients = async (criteria, hospitalId, options) => {
    assert.equal(hospitalId, 1);
    assert.equal(criteria.faceDescriptor, undefined);
    assert.equal(criteria.facePatientIds, undefined);
    assert.deepEqual(options.facePatientIds, [42]);
    assert.equal(options.relaxedFilters, true);
    assert.equal(options.allowCrossHospital, false);
    return { candidates: [patient(42)], weightModel: { maximumScore: ecisService.MAX_SCORE } };
  };

  const result = await search({ faceDescriptor: descriptor, faceModelId: faceProfiles.MODEL_ID, facePatientIds: [999] });
  assert.equal(result.status, 200);
  assert.equal(result.body.resultCount, 1);
  assert.equal(result.body.candidates[0].evidence[0].key, "face");
  assert.ok(result.body.candidates[0].evidence[0].score > 0);
  assert.equal(result.body.candidates[0].faceDistance, 0.2);
  assert.equal(result.body.weightModel.face, 20);
  const audit = statements.find(({ sql }) => sql.includes("INSERT INTO public.ecis_search_logs"));
  assert.ok(audit);
  assert.deepEqual(JSON.parse(audit.params[2]), { faceClueUsed: true });
  assert.equal(JSON.stringify(audit.params).includes("0.01"), false);
  assert.equal(JSON.stringify(audit.params).includes("999"), false);
});

test("clinical search is independent of face matching and both result sets are combined by score", async () => {
  pool.query = async () => ({ rows: [], rowCount: 1 });
  faceProfiles.findMatches = async () => [{ patientId: 42, distance: 0.52 }];
  const calls = [];
  ecisService.searchPatients = async (criteria, hospitalId, options) => {
    calls.push({ criteria, hospitalId, options });
    if (options?.relaxedFilters) return { candidates: [patient(42, 8)] };
    return { candidates: [patient(7, 25), patient(42, 8)], weightModel: { maximumScore: ecisService.MAX_SCORE } };
  };

  const result = await search({ name: "Test", faceDescriptor: Array(128).fill(0), faceModelId: faceProfiles.MODEL_ID });
  assert.equal(result.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].criteria.name, "Test");
  assert.deepEqual(calls[0].options, { allowCrossHospital: false });
  assert.deepEqual(calls[1].options.facePatientIds, [42]);
  assert.equal(calls[1].criteria.name, "Test");
  assert.deepEqual(result.body.candidates.map((item) => item.patientId), [7, 42]);
  assert.equal(result.body.candidates[0].faceDistance, undefined);
  assert.ok(result.body.candidates[1].rawScore > 8);
});

test("failed face threshold still returns clinical candidates", async () => {
  pool.query = async () => ({ rows: [], rowCount: 1 });
  faceProfiles.findMatches = async () => [];
  let calls = 0;
  ecisService.searchPatients = async (criteria, hospitalId, options) => {
    calls += 1;
    assert.equal(criteria.bloodGroup, "O+");
    assert.deepEqual(options, { allowCrossHospital: false });
    return { candidates: [patient(7, 12)], weightModel: { maximumScore: ecisService.MAX_SCORE } };
  };
  const result = await search({ bloodGroup: "O+", faceDescriptor: Array(128).fill(0), faceModelId: faceProfiles.MODEL_ID });
  assert.equal(result.status, 200);
  assert.equal(calls, 1);
  assert.deepEqual(result.body.candidates.map((item) => item.patientId), [7]);
});

test("an empty search is rejected by the backend", async () => {
  const result = await search({});
  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("cross-hospital searching requires a linked unidentified emergency case", async () => {
  pool.query = async (sql) => {
    if (String(sql).includes("FROM public.emergency_cases")) {
      return { rows: [{ emergency_case_id: 5, hospital_id: 1, patient_id: null,
        case_number: "E-5", unidentified_patient: true, status: "ACTIVE" }] };
    }
    return { rows: [], rowCount: 1 };
  };
  ecisService.searchPatients = async (_criteria, _hospitalId, options) => {
    assert.deepEqual(options, { allowCrossHospital: true });
    return { candidates: [patient(42, 12)], weightModel: { maximumScore: ecisService.MAX_SCORE } };
  };
  const result = await search({ emergencyCaseId: 5, name: "Perera" });
  assert.equal(result.status, 200);
  assert.equal(result.body.candidates[0].patientId, 42);
});

test("a discharged emergency case cannot grant cross-hospital search", async () => {
  pool.query = async (sql) => {
    if (String(sql).includes("FROM public.emergency_cases")) {
      return { rows: [{ emergency_case_id: 5, hospital_id: 1,
        unidentified_patient: true, status: "DISCHARGED" }] };
    }
    throw new Error("Search should stop before querying candidates.");
  };
  const result = await search({ emergencyCaseId: 5, name: "Perera" });
  assert.equal(result.status, 400);
  assert.match(result.body.message, /discharged/);
});

test("a weak but accepted face clue never has a zero evidence score", async () => {
  pool.query = async () => ({ rows: [], rowCount: 1 });
  faceProfiles.findMatches = async () => [{ patientId: 42, distance: faceProfiles.MAX_DISTANCE }];
  ecisService.searchPatients = async () => ({
    candidates: [patient(42)],
    weightModel: { maximumScore: ecisService.MAX_SCORE },
  });
  const result = await search({ faceDescriptor: Array(128).fill(0), faceModelId: faceProfiles.MODEL_ID });
  assert.equal(result.status, 200);
  assert.equal(result.body.candidates[0].evidence[0].score, 1);
  assert.equal(result.body.candidates[0].score, 1);
});
