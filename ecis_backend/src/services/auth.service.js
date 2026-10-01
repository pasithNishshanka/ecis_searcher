const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const pool = require("../config/database");
const { hasLocalSystemAdminAccess } = require("../config/localAccess");

const ACCESS_TOKEN_EXPIRES_IN =
  process.env.JWT_ACCESS_EXPIRES_IN ||
  "30m";

const REFRESH_TOKEN_EXPIRES_IN_DAYS = Number(
  process.env.JWT_REFRESH_EXPIRES_IN_DAYS || 7,
);

function optionalPositiveInteger(value, fieldName = "hospitalId") {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return number;
}

function createAccessToken(user, assignment) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured in .env");
  }

  return jwt.sign(
    {
      userId: user.user_id,
      assignmentId: assignment.assignment_id,
      hospitalId: assignment.hospital_id,
      hospitalName: assignment.hospital_name,
      username: user.username,
      fullName: user.full_name,
      role: assignment.role,
      department: assignment.department || user.department,
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN },
  );
}

function createRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

function hashRefreshToken(refreshToken) {
  return crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
}

function getRefreshExpiryDate() {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + REFRESH_TOKEN_EXPIRES_IN_DAYS);
  return expiry;
}

async function getHospitalAssignments(userId) {
  const result = await pool.query(
    `
      SELECT
        a.assignment_id,
        a.hospital_id,
        h.hospital_name,
        a.role,
        a.department,
        a.designation,
        a.license_number,
        a.start_date,
        a.end_date,
        a.status
      FROM public.hospital_user_assignments a
      INNER JOIN public.hospitals h
        ON h.hospital_id = a.hospital_id
       AND h.is_active = TRUE
      WHERE
        a.user_id = $1
        AND a.status = 'ACTIVE'
        AND a.start_date <= CURRENT_DATE
        AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
      ORDER BY a.hospital_id, a.assignment_id;
    `,
    [userId],
  );

  return result.rows;
}

async function resolveHospitalAssignment(userId, requestedHospitalId, requestedAssignmentId) {
  const assignments = await getHospitalAssignments(userId);

  if (assignments.length === 0) {
    throw new Error("No active hospital assignment is available for this user.");
  }

  const hospitalId = optionalPositiveInteger(requestedHospitalId);
  const assignmentId = optionalPositiveInteger(requestedAssignmentId, "assignmentId");

  const assignment = assignmentId
    ? assignments.find((item) => Number(item.assignment_id) === assignmentId)
    : hospitalId
      ? assignments.find((item) => Number(item.hospital_id) === hospitalId)
      : assignments[0];

  if (!assignment || (hospitalId && Number(assignment.hospital_id) !== hospitalId)) {
    throw new Error("The selected hospital assignment is not available for this user.");
  }

  return {
    assignment,
    assignments,
  };
}

function assignmentResponse(assignment) {
  return {
    assignmentId: assignment.assignment_id,
    hospitalId: assignment.hospital_id,
    hospitalName: assignment.hospital_name,
    role: assignment.role,
    department: assignment.department,
    designation: assignment.designation,
    licenseNumber: assignment.license_number,
  };
}

function authenticatedUserResponse(user, assignment, assignments) {
  return {
    userId: user.user_id,
    hospitalId: assignment.hospital_id,
    hospitalName: assignment.hospital_name,
    assignmentId: assignment.assignment_id,
    employeeNumber: user.employee_number,
    internalClinicianId: user.internal_clinician_id,
    fullName: user.full_name,
    username: user.username,
    role: assignment.role,
    allModuleAccess: hasLocalSystemAdminAccess(assignment.role),
    department: assignment.department || user.department,
    phone: user.phone,
    email: user.email,
    hospitalAssignments: assignments.map(assignmentResponse),
  };
}

async function findActiveUserByIdentifier(username) {
  const identifier = String(username || "").trim().toLowerCase();

  if (!identifier) {
    throw new Error("Username and password are required.");
  }

  const result = await pool.query(
    `
      SELECT
        user_id,
        employee_number,
        internal_clinician_id,
        full_name,
        username,
        password_hash,
        role,
        department,
        phone,
        email,
        is_active
      FROM public.hospital_users
      WHERE
        LOWER(TRIM(username)) = $1
        OR LOWER(TRIM(employee_number)) = $1
      LIMIT 1;
    `,
    [identifier],
  );

  if (result.rowCount === 0) {
    throw new Error("Invalid username or password.");
  }

  const user = result.rows[0];

  if (!user.is_active) {
    throw new Error("This user account is inactive.");
  }

  if (!user.password_hash) {
    throw new Error("User password has not been configured.");
  }

  return user;
}

async function findActiveUserById(userId) {
  const result = await pool.query(
    `
      SELECT
        user_id,
        employee_number,
        internal_clinician_id,
        full_name,
        username,
        role,
        department,
        phone,
        email,
        is_active
      FROM public.hospital_users
      WHERE user_id = $1
      LIMIT 1;
    `,
    [userId],
  );

  if (result.rowCount === 0 || !result.rows[0].is_active) {
    throw new Error("This user account is inactive.");
  }

  return result.rows[0];
}

async function buildAuthenticatedContext(user, hospitalId, assignmentId) {
  const { assignment, assignments } = await resolveHospitalAssignment(
    user.user_id,
    hospitalId,
    assignmentId,
  );

  return {
    token: createAccessToken(user, assignment),
    user: authenticatedUserResponse(user, assignment, assignments),
  };
}

async function login({ username, password, hospitalId }) {
  if (!username || !password) {
    throw new Error("Username and password are required.");
  }

  const user = await findActiveUserByIdentifier(username);
  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    throw new Error("Invalid username or password.");
  }

  const context = await buildAuthenticatedContext(user, hospitalId);
  const refreshToken = createRefreshToken();

  await pool.query(
    `
      DELETE FROM public.auth_refresh_tokens
      WHERE
        user_id = $1
        AND (
          expires_at <= CURRENT_TIMESTAMP
          OR revoked_at IS NOT NULL
        );
    `,
    [user.user_id],
  );

  await pool.query(
    `
      INSERT INTO public.auth_refresh_tokens (
        user_id,
        token_hash,
        expires_at
      )
      VALUES ($1, $2, $3);
    `,
    [
      user.user_id,
      hashRefreshToken(refreshToken),
      getRefreshExpiryDate(),
    ],
  );

  await pool.query(
    `
      UPDATE public.hospital_users
      SET
        last_login_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1;
    `,
    [user.user_id],
  );

  return {
    ...context,
    refreshToken,
  };
}

async function refreshAccessToken(refreshToken, hospitalId, assignmentId) {
  if (!refreshToken || typeof refreshToken !== "string") {
    throw new Error("Refresh token is required.");
  }

  const result = await pool.query(
    `
      SELECT
        rt.refresh_token_id,
        rt.user_id,
        rt.expires_at,
        rt.revoked_at,
        u.employee_number,
        u.full_name,
        u.username,
        u.role,
        u.department,
        u.phone,
        u.email,
        u.is_active
      FROM public.auth_refresh_tokens rt
      INNER JOIN public.hospital_users u
        ON u.user_id = rt.user_id
      WHERE rt.token_hash = $1
      LIMIT 1;
    `,
    [hashRefreshToken(refreshToken)],
  );

  if (result.rowCount === 0) {
    throw new Error("Refresh session is invalid.");
  }

  const session = result.rows[0];

  if (session.revoked_at) {
    throw new Error("Refresh session has been revoked.");
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await pool.query(
      `
        UPDATE public.auth_refresh_tokens
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE refresh_token_id = $1;
      `,
      [session.refresh_token_id],
    );

    throw new Error("Refresh session has expired.");
  }

  if (!session.is_active) {
    throw new Error("This user account is inactive.");
  }

  return buildAuthenticatedContext(session, hospitalId, assignmentId);
}

async function switchHospitalContext({ userId, hospitalId, assignmentId }) {
  const user = await findActiveUserById(userId);
  return buildAuthenticatedContext(user, hospitalId, assignmentId);
}

async function getHospitalContext({ userId, hospitalId, assignmentId }) {
  const user = await findActiveUserById(userId);
  const { assignment, assignments } = await resolveHospitalAssignment(
    user.user_id,
    hospitalId,
    assignmentId,
  );

  return authenticatedUserResponse(user, assignment, assignments);
}

async function logout(refreshToken) {
  if (!refreshToken || typeof refreshToken !== "string") {
    return;
  }

  await pool.query(
    `
      UPDATE public.auth_refresh_tokens
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE
        token_hash = $1
        AND revoked_at IS NULL;
    `,
    [hashRefreshToken(refreshToken)],
  );
}

module.exports = {
  login,
  refreshAccessToken,
  switchHospitalContext,
  getHospitalContext,
  logout,
};
