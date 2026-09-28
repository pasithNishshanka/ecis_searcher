/*
 * One-time deployment bootstrap for the first ECIS system administrator.
 *
 * This is intentionally a server-side command, not an unauthenticated HTTP
 * endpoint. It will only create a new staff account and refuses to run after
 * an active SYSTEM_ADMIN assignment exists.
 *
 * Set these in the current shell only (do not add the password to .env):
 *   ECIS_BOOTSTRAP_EMPLOYEE_NUMBER
 *   ECIS_BOOTSTRAP_FULL_NAME
 *   ECIS_BOOTSTRAP_USERNAME
 *   ECIS_BOOTSTRAP_PASSWORD
 * Optional: ECIS_BOOTSTRAP_HOSPITAL_ID, ECIS_BOOTSTRAP_DEPARTMENT,
 *           ECIS_BOOTSTRAP_PHONE, ECIS_BOOTSTRAP_EMAIL
 */

const bcrypt = require("bcryptjs");

const pool = require("../src/config/database");

function requiredEnvironment(name, maxLength) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(`${name} must be supplied for administrator provisioning.`);
  }

  if (value.length > maxLength) {
    throw new Error(`${name} must be ${maxLength} characters or fewer.`);
  }

  return value;
}

function optionalEnvironment(name, maxLength) {
  const value = String(process.env[name] || "").trim();

  if (value.length > maxLength) {
    throw new Error(`${name} must be ${maxLength} characters or fewer.`);
  }

  return value || null;
}

function positiveInteger(value, name) {
  const number = Number(value || 1);

  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return number;
}

async function provisionSystemAdministrator() {
  const employeeNumber = requiredEnvironment("ECIS_BOOTSTRAP_EMPLOYEE_NUMBER", 100);
  const fullName = requiredEnvironment("ECIS_BOOTSTRAP_FULL_NAME", 200);
  const username = requiredEnvironment("ECIS_BOOTSTRAP_USERNAME", 100).toLowerCase();
  const password = requiredEnvironment("ECIS_BOOTSTRAP_PASSWORD", 200);
  const hospitalId = positiveInteger(
    process.env.ECIS_BOOTSTRAP_HOSPITAL_ID,
    "ECIS_BOOTSTRAP_HOSPITAL_ID",
  );
  const department = optionalEnvironment("ECIS_BOOTSTRAP_DEPARTMENT", 150);
  const phone = optionalEnvironment("ECIS_BOOTSTRAP_PHONE", 50);
  const email = optionalEnvironment("ECIS_BOOTSTRAP_EMAIL", 254);

  if (password.length < 12) {
    throw new Error("ECIS_BOOTSTRAP_PASSWORD must be at least 12 characters.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* Serialize the one-time bootstrap across concurrent server operators. */
    await client.query("SELECT pg_advisory_xact_lock(9130471);");

    const administratorResult = await client.query(
      `
        SELECT 1
        FROM public.hospital_user_assignments
        WHERE status = 'ACTIVE' AND role = 'SYSTEM_ADMIN'
        LIMIT 1
        FOR UPDATE;
      `,
    );

    if (administratorResult.rowCount > 0) {
      throw new Error("An active SYSTEM_ADMIN already exists. Use the Settings administration page instead.");
    }

    const hospitalResult = await client.query(
      `
        SELECT hospital_id, hospital_name
        FROM public.hospitals
        WHERE hospital_id = $1 AND is_active = TRUE
        FOR KEY SHARE;
      `,
      [hospitalId],
    );

    if (hospitalResult.rowCount === 0) {
      throw new Error("The requested bootstrap hospital is inactive or does not exist.");
    }

    const existingUserResult = await client.query(
      `
        SELECT user_id
        FROM public.hospital_users
        WHERE LOWER(username) = $1 OR employee_number = $2
        LIMIT 1
        FOR KEY SHARE;
      `,
      [username, employeeNumber],
    );

    if (existingUserResult.rowCount > 0) {
      throw new Error("A staff account already uses this username or employee number. Existing accounts are never promoted by the bootstrap command.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userResult = await client.query(
      `
        INSERT INTO public.hospital_users (
          hospital_id,
          employee_number,
          full_name,
          username,
          password_hash,
          role,
          department,
          phone,
          email,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'SYSTEM_ADMIN', $6, $7, $8, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING user_id;
      `,
      [
        hospitalId,
        employeeNumber,
        fullName,
        username,
        passwordHash,
        department,
        phone,
        email,
      ],
    );

    const userId = userResult.rows[0].user_id;
    await client.query(
      `
        INSERT INTO public.hospital_user_assignments (
          user_id,
          hospital_id,
          role,
          department,
          start_date,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, 'SYSTEM_ADMIN', $3, CURRENT_DATE, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      `,
      [userId, hospitalId, department],
    );

    await client.query("COMMIT");

    console.log(
      `Created SYSTEM_ADMIN account ${username} for ${hospitalResult.rows[0].hospital_name}.`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

provisionSystemAdministrator()
  .catch((error) => {
    console.error(`System administrator provisioning failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
