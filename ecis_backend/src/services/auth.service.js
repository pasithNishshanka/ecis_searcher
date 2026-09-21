const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const pool = require("../config/database");

const ACCESS_TOKEN_EXPIRES_IN =
  process.env.JWT_ACCESS_EXPIRES_IN ||
  "30m";

const REFRESH_TOKEN_EXPIRES_IN_DAYS =
  Number(
    process.env.JWT_REFRESH_EXPIRES_IN_DAYS ||
      7,
  );

function createAccessToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET is not configured in .env",
    );
  }

  return jwt.sign(
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
        ACCESS_TOKEN_EXPIRES_IN,
    },
  );
}

function createRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

function hashRefreshToken(
  refreshToken,
) {
  return crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
}

function getRefreshExpiryDate() {
  const expiry =
    new Date();

  expiry.setDate(
    expiry.getDate() +
      REFRESH_TOKEN_EXPIRES_IN_DAYS,
  );

  return expiry;
}

async function login({
  username,
  password,
}) {
  if (!username || !password) {
    throw new Error(
      "Username and password are required.",
    );
  }

  const normalizedUsername =
    String(username)
      .trim()
      .toLowerCase();

  const result =
    await pool.query(
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
      "Invalid username or password.",
    );
  }

  const user =
    result.rows[0];

  if (!user.is_active) {
    throw new Error(
      "This user account is inactive.",
    );
  }

  if (!user.password_hash) {
    throw new Error(
      "User password has not been configured.",
    );
  }

  const passwordMatches =
    await bcrypt.compare(
      password,
      user.password_hash,
    );

  if (!passwordMatches) {
    throw new Error(
      "Invalid username or password.",
    );
  }

  const accessToken =
    createAccessToken(user);

  const refreshToken =
    createRefreshToken();

  const refreshTokenHash =
    hashRefreshToken(
      refreshToken,
    );

  const refreshExpiresAt =
    getRefreshExpiryDate();

  /*
   * Remove old expired/revoked refresh sessions
   * belonging to this user.
   */
  await pool.query(
    `
    DELETE FROM auth_refresh_tokens
    WHERE
      user_id = $1
      AND (
        expires_at <= CURRENT_TIMESTAMP
        OR revoked_at IS NOT NULL
      )
    `,
    [user.user_id],
  );

  await pool.query(
    `
    INSERT INTO auth_refresh_tokens (
      user_id,
      token_hash,
      expires_at
    )
    VALUES (
      $1,
      $2,
      $3
    )
    `,
    [
      user.user_id,
      refreshTokenHash,
      refreshExpiresAt,
    ],
  );

  await pool.query(
    `
    UPDATE public.hospital_users
    SET
      last_login_at =
        CURRENT_TIMESTAMP,
      updated_at =
        CURRENT_TIMESTAMP
    WHERE user_id = $1
    `,
    [user.user_id],
  );

  return {
    token: accessToken,

    refreshToken,

    user: {
      userId:
        user.user_id,

      hospitalId:
        user.hospital_id,

      employeeNumber:
        user.employee_number,

      fullName:
        user.full_name,

      username:
        user.username,

      role:
        user.role,

      department:
        user.department,

      phone:
        user.phone,

      email:
        user.email,
    },
  };
}

async function refreshAccessToken(
  refreshToken,
) {
  if (
    !refreshToken ||
    typeof refreshToken !==
      "string"
  ) {
    throw new Error(
      "Refresh token is required.",
    );
  }

  const tokenHash =
    hashRefreshToken(
      refreshToken,
    );

  const result =
    await pool.query(
      `
      SELECT
        rt.refresh_token_id,
        rt.user_id,
        rt.expires_at,
        rt.revoked_at,

        u.hospital_id,
        u.employee_number,
        u.full_name,
        u.username,
        u.role,
        u.department,
        u.phone,
        u.email,
        u.is_active

      FROM auth_refresh_tokens rt

      INNER JOIN hospital_users u
        ON u.user_id =
          rt.user_id

      WHERE
        rt.token_hash = $1

      LIMIT 1
      `,
      [tokenHash],
    );

  if (result.rows.length === 0) {
    throw new Error(
      "Refresh session is invalid.",
    );
  }

  const session =
    result.rows[0];

  if (session.revoked_at) {
    throw new Error(
      "Refresh session has been revoked.",
    );
  }

  if (
    new Date(
      session.expires_at,
    ).getTime() <= Date.now()
  ) {
    await pool.query(
      `
      UPDATE auth_refresh_tokens
      SET
        revoked_at =
          CURRENT_TIMESTAMP
      WHERE
        refresh_token_id = $1
      `,
      [
        session.refresh_token_id,
      ],
    );

    throw new Error(
      "Refresh session has expired.",
    );
  }

  if (!session.is_active) {
    throw new Error(
      "This user account is inactive.",
    );
  }

  const accessToken =
    createAccessToken({
      user_id:
        session.user_id,

      hospital_id:
        session.hospital_id,

      username:
        session.username,

      full_name:
        session.full_name,

      role:
        session.role,

      department:
        session.department,
    });

  return {
    token: accessToken,

    user: {
      userId:
        session.user_id,

      hospitalId:
        session.hospital_id,

      employeeNumber:
        session.employee_number,

      fullName:
        session.full_name,

      username:
        session.username,

      role:
        session.role,

      department:
        session.department,

      phone:
        session.phone,

      email:
        session.email,
    },
  };
}

async function logout(
  refreshToken,
) {
  if (
    !refreshToken ||
    typeof refreshToken !==
      "string"
  ) {
    return;
  }

  const tokenHash =
    hashRefreshToken(
      refreshToken,
    );

  await pool.query(
    `
    UPDATE auth_refresh_tokens
    SET
      revoked_at =
        CURRENT_TIMESTAMP
    WHERE
      token_hash = $1
      AND revoked_at IS NULL
    `,
    [tokenHash],
  );
}

module.exports = {
  login,
  refreshAccessToken,
  logout,
};