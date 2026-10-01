const fs = require("node:fs");
const path = require("node:path");

const pool = require("../src/config/database");

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "../sql/internal_clinician_ids.sql"), "utf8");
  await pool.query(sql);
  console.log("Internal clinician IDs are ready.");
}

main()
  .catch((error) => {
    console.error("Internal clinician ID migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
