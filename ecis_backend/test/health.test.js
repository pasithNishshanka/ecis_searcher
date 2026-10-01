const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const pool = require("../src/config/database");
const app = require("../src/app");

const originalQuery = pool.query;
after(() => { pool.query = originalQuery; });

async function requestHealth() {
  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("health is online only when PostgreSQL responds", async () => {
  pool.query = async () => ({ rows: [{ '?column?': 1 }] });
  const result = await requestHealth();
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
});

test("health reports unavailable when PostgreSQL fails", async () => {
  pool.query = async () => { throw new Error("connection refused"); };
  const result = await requestHealth();
  assert.equal(result.status, 503);
  assert.equal(result.body.success, false);
  assert.equal(JSON.stringify(result.body).includes("connection refused"), false);
});
