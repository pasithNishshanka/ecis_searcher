const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
  try {
    const authorization =
      req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        success: false,
        message:
          "Authorization token is required",
      });
    }

    const parts =
      authorization.trim().split(/\s+/);

    if (parts.length !== 2) {
      return res.status(401).json({
        success: false,
        message:
          "Authorization header must use Bearer token",
      });
    }

    const [scheme, token] = parts;

    if (
      scheme.toLowerCase() !== "bearer" ||
      !token
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Authorization header must use Bearer token",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error(
        "JWT_SECRET is not configured",
      );

      return res.status(500).json({
        success: false,
        message:
          "Authentication configuration error",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
    );

    if (
      !decoded.userId ||
      !decoded.hospitalId ||
      !decoded.role
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication token is missing required user information",
      });
    }

    req.user = {
      userId: decoded.userId,
      hospitalId: decoded.hospitalId,
      username: decoded.username,
      fullName: decoded.fullName,
      role: decoded.role,
      department: decoded.department,
    };

    next();
  } catch (error) {
    console.error(
      "Authentication middleware error:",
      error.message,
    );

    return res.status(401).json({
      success: false,
      message:
        "Invalid or expired authentication token",
    });
  }
};

module.exports = {
  authenticate,
};