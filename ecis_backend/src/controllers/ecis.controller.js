const ecisService = require("../services/ecis.service");
const pool = require("../config/database");

const searchECISCandidates = async (req, res) => {
  try {
    const criteria = req.body || {};

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user information is required",
      });
    }

    const emergencyCaseId = Number(criteria.emergencyCaseId);

    if (!Number.isInteger(emergencyCaseId) || emergencyCaseId <= 0) {
      return res.status(400).json({
        success: false,
        message: "emergencyCaseId must be a valid positive number",
      });
    }

    const emergencyCaseResult = await pool.query(
      `
        SELECT
          emergency_case_id,
          hospital_id,
          patient_id,
          case_number,
          unidentified_patient,
          status
        FROM public.emergency_cases
        WHERE emergency_case_id = $1
        LIMIT 1;
      `,
      [emergencyCaseId],
    );

    if (emergencyCaseResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Emergency case not found",
      });
    }

    const emergencyCase = emergencyCaseResult.rows[0];

    if (
      Number(emergencyCase.hospital_id) !==
      Number(req.user.hospitalId)
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this emergency case",
      });
    }

    if (!emergencyCase.unidentified_patient) {
      return res.status(400).json({
        success: false,
        message:
          "ECIS search is only available for unidentified emergency cases",
      });
    }

    const {
      emergencyCaseId: _ignored,
      ...searchCriteria
    } = criteria;

    const candidates = await ecisService.searchCandidates(
      searchCriteria,
      req.user.hospitalId,
    );

    await pool.query(
      `
        INSERT INTO public.ecis_search_logs (
          emergency_case_id,
          searched_by,
          search_criteria,
          result_count
        )
        VALUES ($1, $2, $3, $4);
      `,
      [
        emergencyCaseId,
        req.user.userId,
        JSON.stringify(searchCriteria),
        candidates.length,
      ],
    );

    return res.status(200).json({
      success: true,
      message: "ECIS candidate search completed successfully",
      emergencyCase: {
        emergencyCaseId: emergencyCase.emergency_case_id,
        caseNumber: emergencyCase.case_number,
        hospitalId: emergencyCase.hospital_id,
        status: emergencyCase.status,
      },
      resultCount: candidates.length,
      candidates,
    });
  } catch (error) {
    console.error("ECIS search error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to perform ECIS candidate search",
      error: error.message,
    });
  }
};

module.exports = {
  searchECISCandidates,
};
