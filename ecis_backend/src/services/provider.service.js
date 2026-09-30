const pool = require("../config/database");

const CLINICAL_ROLES = new Set([
  "DOCTOR", "SURGEON", "RADIOLOGIST", "LAB_TECHNICIAN", "PHARMACIST",
]);

async function listProviders(hospitalId, role = null) {
  const selectedRoles = role
    ? String(role).split(",").map((item) => item.trim().toUpperCase()).filter(Boolean)
    : [...CLINICAL_ROLES];
  if (selectedRoles.length === 0 || selectedRoles.some((item) => !CLINICAL_ROLES.has(item))) {
    const error = new Error("Unsupported provider role.");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `SELECT u.user_id, u.full_name, a.role, a.department,
            a.designation, a.license_number
       FROM public.hospital_user_assignments a
       JOIN public.hospital_users u ON u.user_id = a.user_id
      WHERE a.hospital_id = $1
        AND u.is_active = TRUE
        AND a.status = 'ACTIVE'
        AND a.start_date <= CURRENT_DATE
        AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
        AND a.role = ANY($2::varchar[])
      ORDER BY u.full_name, u.user_id;`,
    [hospitalId, selectedRoles],
  );

  return result.rows.map((row) => ({
    userId: Number(row.user_id),
    fullName: row.full_name,
    role: row.role,
    department: row.department,
    designation: row.designation,
    licenseNumber: row.license_number,
  }));
}

module.exports = { listProviders };
