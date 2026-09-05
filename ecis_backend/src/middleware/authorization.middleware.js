const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required",
      });
    }

    const userRole = String(req.user.role || "")
      .trim()
      .toUpperCase();

    const normalizedAllowedRoles = allowedRoles.map((role) =>
      String(role).trim().toUpperCase(),
    );

    if (!normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this operation",
      });
    }

    next();
  };
};

module.exports = {
  authorizeRoles,
};
