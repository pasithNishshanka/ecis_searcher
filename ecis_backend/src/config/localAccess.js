function hasLocalSystemAdminAccess(role) {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ECIS_EXAM_FULL_ACCESS === "true" &&
    String(role || "").trim().toUpperCase() === "SYSTEM_ADMIN"
  );
}

module.exports = { hasLocalSystemAdminAccess };
