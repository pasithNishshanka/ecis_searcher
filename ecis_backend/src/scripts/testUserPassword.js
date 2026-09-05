const readline = require("readline");
const bcrypt = require("bcryptjs");

const pool = require("../config/database");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (question) =>
  new Promise((resolve) => {
    rl.question(question, resolve);
  });

const main = async () => {
  try {
    console.log("\n=== ECIS User Login Diagnostic ===\n");

    const username = (await askQuestion("Username: ")).trim();

    const password = await askQuestion("Password: ");

    if (!username) {
      throw new Error("Username cannot be empty");
    }

    if (!password) {
      throw new Error("Password cannot be empty");
    }

    const result = await pool.query(
      `
      SELECT
        user_id,
        hospital_id,
        username,
        full_name,
        password_hash
      FROM public.hospital_users
      WHERE LOWER(TRIM(username)) = LOWER(TRIM($1))
      LIMIT 1
      `,
      [username],
    );

    if (result.rows.length === 0) {
      console.log("\nRESULT: USER NOT FOUND");
      console.log(`No user exists with username: ${username}`);
      return;
    }

    const user = result.rows[0];

    console.log("\nUser found:");
    console.log(`User ID: ${user.user_id}`);
    console.log(`Username: ${user.username}`);
    console.log(`Full Name: ${user.full_name}`);
    console.log(`Hospital ID: ${user.hospital_id}`);
    console.log(`Hash prefix: ${user.password_hash.substring(0, 4)}`);
    console.log(`Hash length: ${user.password_hash.length}`);

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    console.log(`\nPassword match: ${passwordMatches}`);

    if (passwordMatches) {
      console.log("RESULT: LOGIN CREDENTIALS ARE CORRECT");
    } else {
      console.log("RESULT: PASSWORD DOES NOT MATCH");
    }
  } catch (error) {
    console.error("\nDiagnostic error:", error.message);
  } finally {
    rl.close();
    await pool.end();
  }
};

main();
