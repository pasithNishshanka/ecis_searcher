require("dotenv").config();

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
    console.log("\n=== ECIS Password Reset ===\n");

    const username = (await askQuestion("Username: ")).trim();

    const newPassword = await askQuestion("New password: ");

    if (!username) {
      throw new Error("Username cannot be empty");
    }

    if (!newPassword) {
      throw new Error("Password cannot be empty");
    }

    if (newPassword.length < 8) {
      throw new Error("Password must contain at least 8 characters");
    }

    const userResult = await pool.query(
      `
      SELECT
        user_id,
        hospital_id,
        username,
        full_name
      FROM public.hospital_users
      WHERE LOWER(TRIM(username)) = LOWER(TRIM($1))
      LIMIT 1
      `,
      [username],
    );

    if (userResult.rows.length === 0) {
      throw new Error(`User '${username}' was not found`);
    }

    const user = userResult.rows[0];

    const passwordHash = await bcrypt.hash(newPassword, 12);

    const updateResult = await pool.query(
      `
      UPDATE public.hospital_users
      SET
        password_hash = $1
      WHERE user_id = $2
      `,
      [passwordHash, user.user_id],
    );

    if (updateResult.rowCount !== 1) {
      throw new Error("Password update failed");
    }

    const verifyResult = await pool.query(
      `
      SELECT password_hash
      FROM public.hospital_users
      WHERE user_id = $1
      `,
      [user.user_id],
    );

    const passwordVerified = await bcrypt.compare(
      newPassword,
      verifyResult.rows[0].password_hash,
    );

    console.log("\nPassword updated successfully.");

    console.log(`User ID: ${user.user_id}`);

    console.log(`Username: ${user.username}`);

    console.log(`Full Name: ${user.full_name}`);

    console.log(`Bcrypt verification: ${passwordVerified}`);

    if (!passwordVerified) {
      throw new Error("Password was updated but verification failed");
    }

    console.log("\nYou can now use this username and password for login.\n");
  } catch (error) {
    console.error("\nPassword reset failed:", error.message);
  } finally {
    rl.close();

    await pool.end();
  }
};

main();
