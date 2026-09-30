const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { after, test } = require("node:test");
const express = require("express");
const pool = require("../src/config/database");
const { detectMimeType } = require("../src/middleware/radiologyUpload.middleware");
const { uploadECISSearchImage } = require("../src/middleware/ecisImageSearch.middleware");
const { findStoredImageMatches } = require("../src/services/ecisImageSearch.service");
const { searchByStoredImage } = require("../src/controllers/ecisImageSearch.controller");

const originalQuery = pool.query;
after(() => { pool.query = originalQuery; });

test("recognizes a PNG signature and rejects arbitrary bytes", () => {
  assert.equal(detectMimeType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(detectMimeType(Buffer.from("not an image")), null);
});

test("multipart image search keeps a valid file in memory and rejects a fake image", async () => {
  const app = express();
  app.post("/image", uploadECISSearchImage, (req, res) => {
    res.json({ type: req.file.detectedMimeType, bytes: req.file.buffer.length, hasPath: Boolean(req.file.path) });
  });
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/image`;
    const valid = new FormData();
    valid.append("image", new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" }), "scan.png");
    const validResponse = await fetch(url, { method: "POST", body: valid });
    assert.equal(validResponse.status, 200);
    assert.deepEqual(await validResponse.json(), { type: "image/png", bytes: 8, hasPath: false });

    const invalid = new FormData();
    invalid.append("image", new Blob(["not an image"], { type: "image/png" }), "scan.png");
    const invalidResponse = await fetch(url, { method: "POST", body: invalid });
    assert.equal(invalidResponse.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("exact image lookup scopes the checksum to the authenticated hospital", async () => {
  const calls = [];
  const file = Buffer.from("image query bytes");
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ image_id: "9", patient_id: "4", investigation_id: "7",
      patient_number: "P000004", patient_name: "Patient Name",
      investigation_name: "Chest radiograph", investigation_status: "VERIFIED",
      verified_report_summary: "Report already recorded" }] };
  };

  const matches = await findStoredImageMatches(file, 2);
  assert.equal(calls[0].params[0], crypto.createHash("sha256").update(file).digest("hex"));
  assert.equal(calls[0].params[1], 2);
  assert.match(calls[0].sql, /ri\.hospital_id = \$2/);
  assert.match(calls[0].sql, /phr\.hospital_id = \$2/);
  assert.equal(matches[0].patientId, 4);
  assert.equal(matches[0].verifiedReportSummary, "Report already recorded");
  assert.ok(!JSON.stringify(matches).includes(calls[0].params[0]));
});

test("image search audits the candidate IDs without saving image contents", async () => {
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes("FROM public.radiology_images")) {
      return { rows: [{ image_id: "9", patient_id: "4", investigation_id: "7",
        patient_number: "P000004", patient_name: "Patient Name",
        investigation_name: "Chest radiograph", investigation_status: "VERIFIED",
        verified_report_summary: "Report already recorded" }] };
    }
    return { rows: [], rowCount: 1 };
  };
  const req = { user: { hospitalId: 2, userId: 5 }, file: { buffer: Buffer.from("image query bytes") } };
  let response;
  const res = { status(code) { this.statusCode = code; return this; }, json(body) { response = body; return this; } };
  await searchByStoredImage(req, res, (error) => { throw error; });
  assert.equal(res.statusCode, 200);
  assert.equal(response.matches.length, 1);
  const audit = calls.find(({ sql }) => sql.includes("INSERT INTO public.ecis_search_logs"));
  assert.deepEqual(audit.params[3], [4]);
  assert.equal(JSON.parse(audit.params[1]).imageReferenceLookup, true);
  assert.ok(!JSON.stringify(audit.params).includes("image query bytes"));
});
