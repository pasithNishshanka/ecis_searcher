const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
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

    if (
      !Number.isInteger(userId) ||
      userId <= 0 ||
      !Number.isInteger(hospitalId) ||
      hospitalId <= 0
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

    req.user = {
      userId,
      hospitalId,
      username:
        decoded.username || null,
      fullName:
        decoded.fullName || null,
      role:
        decoded.role || null,
      department:
        decoded.department || null,
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