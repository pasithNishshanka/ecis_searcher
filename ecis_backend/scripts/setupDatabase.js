const fs = require("node:fs");
const path = require("node:path");
const pool = require("../src/config/database");

const baselinePath = path.join(__dirname, "../sql/00_baseline.sql");
const baselineSql = fs.readFileSync(baselinePath, "utf8");
const expectedTables = [...baselineSql.matchAll(/^CREATE TABLE public\.([a-z_]+) \(/gm)]
  .map((match) => match[1]);

if (expectedTables.length < 35 || /^\s*DROP\s/im.test(baselineSql) || /^\\/m.test(baselineSql)) {
  throw new Error("The baseline is incomplete or contains a destructive/psql-only command.");
}

async function listTables(client) {
  const result = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  return result.rows.map((row) => row.table_name);
}

async function main() {
  const apply = process.argv.includes("--apply");
  if (process.argv.slice(2).some((arg) => arg !== "--apply")) {
    throw new Error("Usage: node scripts/setupDatabase.js [--apply]");
  }

  const client = await pool.connect();
  let transactionOpen = false;
  try {
    const existingTables = await listTables(client);
    const missing = expectedTables.filter((name) => !existingTables.includes(name));

    if (existingTables.length > 0) {
      if (missing.length) {
        throw new Error(`Existing database is incomplete (${missing.length} missing tables: ${missing.join(", ")}). No changes made. Restore a backup or migrate it explicitly; the baseline is for empty databases only.`);
      }
      console.log(`Existing database already has all ${expectedTables.length} baseline tables. No changes made.`);
      return;
    }

    if (!apply) {
      console.log(`Database is empty. Run npm run db:setup to create ${expectedTables.length} schema tables. No changes made.`);
      process.exitCode = 1;
      return;
    }

    await client.query("BEGIN");
    transactionOpen = true;
    await client.query(baselineSql);
    const createdTables = await listTables(client);
    const stillMissing = expectedTables.filter((name) => !createdTables.includes(name));
    if (stillMissing.length) {
      throw new Error(`Bootstrap did not create all expected tables: ${stillMissing.join(", ")}`);
    }
    await client.query("COMMIT");
    transactionOpen = false;
    await client.query("RESET ALL");
    console.log(`Created ${expectedTables.length} schema tables in the empty database. No sample patients or staff were inserted.`);
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
