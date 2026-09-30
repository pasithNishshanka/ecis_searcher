const pool = require("../config/database");
const providerService = require("../services/provider.service");

async function getProviders(req, res, next) {
  try {
    const activeHospitalId = Number(req.user?.hospitalId);
    const requestedHospitalId = req.query.hospitalId == null
      ? activeHospitalId
      : Number(req.query.hospitalId);
    if (!Number.isInteger(requestedHospitalId) || requestedHospitalId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid hospitalId." });
    }

    if (requestedHospitalId !== activeHospitalId) {
      const assignment = await pool.query(
        `SELECT 1 FROM public.hospital_user_assignments a
          JOIN public.hospitals h ON h.hospital_id = a.hospital_id
         WHERE a.user_id = $1 AND a.hospital_id = $2
           AND a.status = 'ACTIVE' AND h.is_active = TRUE
           AND a.start_date <= CURRENT_DATE
           AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
         LIMIT 1;`,
        [req.user.userId, requestedHospitalId],
      );
      if (assignment.rowCount === 0) {
        return res.status(403).json({ success: false, message: "Hospital assignment required." });
      }
    }

    const providers = await providerService.listProviders(requestedHospitalId, req.query.role);
    return res.status(200).json({ success: true, count: providers.length, data: providers });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
}

module.exports = { getProviders };
