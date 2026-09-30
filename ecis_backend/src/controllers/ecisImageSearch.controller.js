const pool = require("../config/database");
const { findStoredImageMatches } = require("../services/ecisImageSearch.service");

async function searchByStoredImage(req, res, next) {
  try {
    const hospitalId = Number(req.user?.hospitalId);
    const userId = Number(req.user?.userId);
    if (!Number.isInteger(hospitalId) || hospitalId <= 0 ||
        !Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: "An active hospital session is required." });
    }

    const matches = await findStoredImageMatches(req.file.buffer, hospitalId);
    const patientIds = [...new Set(matches.map((match) => match.patientId))];
    await pool.query(
      `INSERT INTO public.ecis_search_logs (
         emergency_case_id, searched_by, search_criteria, result_count, candidate_patient_ids
       ) VALUES (NULL, $1, $2::jsonb, $3, $4::bigint[]);`,
      [userId, JSON.stringify({ imageReferenceLookup: true }), patientIds.length, patientIds],
    );

    return res.status(200).json({
      success: true,
      matchType: "EXACT_STORED_FILE",
      message: matches.length
        ? "Matching stored radiology image found. Review the patient record before confirming identity."
        : "No identical radiology image is stored in this hospital.",
      matches,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { searchByStoredImage };
