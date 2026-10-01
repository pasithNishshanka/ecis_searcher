// Integration smoke test: create a uniquely named empty database, install the
// baseline, verify its objects, then drop only that database created here.
require("dotenv").config();
const crypto = require("node:crypto");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Client } = require("pg");

const testName = `ecis_schema_smoke_${crypto.randomBytes(6).toString("hex")}`;
const connection = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

async function main() {
  if (testName === process.env.DB_NAME || !/^ecis_schema_smoke_[0-9a-f]{12}$/.test(testName)) {
    throw new Error("Unsafe test database name.");
  }
  const admin = new Client({ ...connection, database: "postgres" });
  let created = false;
  let testClient;
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${testName}" TEMPLATE template0;`);
    created = true;
    const run = spawnSync(process.execPath, [path.join(__dirname, "setupDatabase.js"), "--apply"], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, DB_NAME: testName },
      encoding: "utf8",
      timeout: 120_000,
    });
    if (run.status !== 0) {
      throw new Error(`Empty-database bootstrap failed: ${run.stderr || run.stdout || run.error?.message}`);
    }
    testClient = new Client({ ...connection, database: testName });
    await testClient.connect();
    const counts = await testClient.query(`
      SELECT
        (SELECT count(*)::int FROM information_schema.tables
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tables,
        (SELECT count(*)::int FROM pg_trigger t
          JOIN pg_class c ON c.oid = t.tgrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE NOT t.tgisinternal AND n.nspname = 'public') AS triggers;
    `);
    if (counts.rows[0].tables !== 39 || counts.rows[0].triggers < 6) {
      throw new Error(`Unexpected bootstrap object counts: ${JSON.stringify(counts.rows[0])}`);
    }
    console.log(`Fresh database bootstrap verified: ${counts.rows[0].tables} tables, ${counts.rows[0].triggers} triggers.`);
  } finally {
    if (testClient) await testClient.end();
    if (created) await admin.query(`DROP DATABASE "${testName}";`);
    await admin.end();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
