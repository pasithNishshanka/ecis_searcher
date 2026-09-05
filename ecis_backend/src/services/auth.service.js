const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const pool = require("../config/database");

const login = async ({ username, password }) => {
  if (!username || !password) {
    throw new Error(
      "Username and password are required",
    );
  }

  const normalizedUsername =
    username.trim().toLowerCase();

  const result = await pool.query(
    `
    SELECT
      user_id,
      hospital_id,
      employee_number,
      full_name,
      username,
      password_hash,
      role,
      department,
      phone,
      email,
      is_active
    FROM public.hospital_users
    WHERE LOWER(TRIM(username)) = $1
    LIMIT 1
    `,
    [normalizedUsername],
  );

  if (result.rows.length === 0) {
    throw new Error(
      "Invalid username or password",
    );
  }

  const user = result.rows[0];

  if (!user.is_active) {
    throw new Error(
      "This user account is inactive",
    );
  }

  if (!user.password_hash) {
    throw new Error(
      "User password has not been configured",
    );
  }

  const passwordMatches =
    await bcrypt.compare(
      password,
      user.password_hash,
    );

  if (!passwordMatches) {
    throw new Error(
      "Invalid username or password",
    );
  }

  if (!process.env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET is not configured in .env",
    );
  }

  const token = jwt.sign(
    {
      userId: user.user_id,
      hospitalId: user.hospital_id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      department: user.department,
    },
    process.env.JWT_SECRET,
    {
      expiresIn:
        process.env.JWT_EXPIRES_IN || "8h",
    },
  );

  await pool.query(
    `
    UPDATE public.hospital_users
    SET
      last_login_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
    `,
    [user.user_id],
  );

  return {
    token,
    user: {
      userId: user.user_id,
      hospitalId: user.hospital_id,
      employeeNumber:
        user.employee_number,
      fullName: user.full_name,
      username: user.username,
      role: user.role,
      department: user.department,
      phone: user.phone,
      email: user.email,
    },
  };
};

module.exports = {
  login,
};