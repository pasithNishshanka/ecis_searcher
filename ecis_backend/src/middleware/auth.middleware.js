const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
  try {
    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please sign in.",
        code: "AUTH_REQUIRED",
      });
    }

    const token = authorization.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing. Please sign in again.",
        code: "TOKEN_MISSING",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      userId: decoded.userId,
      hospitalId: decoded.hospitalId,
      username: decoded.username,
      fullName: decoded.fullName,
      role: decoded.role,
      department: decoded.department,
    };

    return next();
  } catch (error) {
    if (error && error.name === "TokenExpiredError") {
      console.warn("Authentication middleware: JWT expired.");

      return res.status(401).json({
        success: false,
        message: "Your session has expired. Please sign in again.",
        code: "TOKEN_EXPIRED",
      });
    }

    if (error && error.name === "JsonWebTokenError") {
      console.warn("Authentication middleware: invalid JWT.");

      return res.status(401).json({
        success: false,
        message: "Your session is invalid. Please sign in again.",
        code: "TOKEN_INVALID",
      });
    }

    console.error("Authentication middleware error:", error);

    return res.status(500).json({
      success: false,
      message: "Authentication service error.",
      code: "AUTH_ERROR",
    });
  }
}

module.exports = {
  authenticate,
};
