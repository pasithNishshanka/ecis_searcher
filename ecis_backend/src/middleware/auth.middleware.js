const jwt = require("jsonwebtoken");
const pool = require("../config/database");

async function authenticate(req, res, next) {
  try {
    const authorization =
      req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required. Please sign in.",
        code: "AUTH_REQUIRED",
      });
    }

    const token =
      authorization
        .substring(7)
        .trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication token is missing.",
        code: "TOKEN_MISSING",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error(
        "Authentication middleware: JWT_SECRET is missing.",
      );

      return res.status(500).json({
        success: false,
        message:
          "Authentication configuration error.",
        code: "AUTH_CONFIG_ERROR",
      });
    }

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET,
      );

    /*
     * Make sure the required claims actually exist.
     * This prevents malformed but technically valid
     * JWTs from becoming authenticated users.
     */
    const userId = Number(
      decoded.userId,
    );

    const hospitalId = Number(
      decoded.hospitalId,
    );
    const role = String(
      decoded.role || "",
    ).trim().toUpperCase();
    const assignmentId = Number(
      decoded.assignmentId,
    );

    if (
      !Number.isInteger(userId) ||
      userId <= 0 ||
      !Number.isInteger(hospitalId) ||
      hospitalId <= 0 ||
      !role
    ) {
      console.warn(
        "Authentication middleware: JWT missing valid user/hospital claims.",
      );

      return res.status(401).json({
        success: false,
        message:
          "Your session is invalid. Please sign in again.",
        code: "TOKEN_INVALID",
      });
    }

    const activeContext = await pool.query(
      `
        SELECT
          u.username,
          u.full_name,
          a.assignment_id,
          a.role,
          a.department
        FROM public.hospital_users u
        INNER JOIN public.hospital_user_assignments a
          ON a.user_id = u.user_id
         AND a.hospital_id = $2
        INNER JOIN public.hospitals h
          ON h.hospital_id = a.hospital_id
        WHERE
          u.user_id = $1
          AND u.is_active = TRUE
          AND h.is_active = TRUE
          AND a.status = 'ACTIVE'
          AND a.start_date <= CURRENT_DATE
          AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
          AND UPPER(a.role) = $4
          AND ($3::BIGINT IS NULL OR a.assignment_id = $3)
        LIMIT 1;
      `,
      [
        userId,
        hospitalId,
        Number.isInteger(assignmentId) && assignmentId > 0
          ? assignmentId
          : null,
        role,
      ],
    );

    if (activeContext.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message:
          "Your account or hospital assignment is no longer active. Please sign in again.",
        code: "AUTH_ASSIGNMENT_REVOKED",
      });
    }

    const authenticatedContext = activeContext.rows[0];

    req.user = {
      userId,
      hospitalId,
      assignmentId: Number(authenticatedContext.assignment_id),
      username: authenticatedContext.username,
      fullName: authenticatedContext.full_name,
      role: authenticatedContext.role,
      department: authenticatedContext.department || null,
    };

    return next();
  } catch (error) {
    if (
      error &&
      error.name ===
        "TokenExpiredError"
    ) {
      /*
       * Token expiry is normal with short-lived
       * access tokens. Do not treat it as a server
       * failure.
       */
      return res.status(401).json({
        success: false,
        message:
          "Access token expired.",
        code: "TOKEN_EXPIRED",
      });
    }

    if (
      error &&
      error.name ===
        "JsonWebTokenError"
    ) {
      /*
       * Do not print a warning for every normal
       * invalid/expired browser token. The frontend
       * will attempt refresh when appropriate.
       */
      return res.status(401).json({
        success: false,
        message:
          "Access token is invalid.",
        code: "TOKEN_INVALID",
      });
    }

    if (
      error &&
      error.name ===
        "NotBeforeError"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Access token is not active yet.",
        code: "TOKEN_NOT_ACTIVE",
      });
    }

    console.error(
      "Authentication middleware error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Authentication service error.",
      code: "AUTH_ERROR",
    });
  }
}

module.exports = {
  authenticate,
};
