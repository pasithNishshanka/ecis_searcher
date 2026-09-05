const ecisService = require("../services/ecis.service");
const pool = require("../config/database");

const searchECISCandidates = async (
  req,
  res,
) => {
  try {
    const criteria = req.body || {};

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated user information is required",
      });
    }

    const emergencyCaseId =
      criteria.emergencyCaseId;

    if (!emergencyCaseId) {
      return res.status(400).json({
        success: false,
        message:
          "emergencyCaseId is required for ECIS search",
      });
    }

    /*
     * -------------------------------------------------------
     * 1. Get emergency case
     * -------------------------------------------------------
     */

    const emergencyCaseResult =
      await pool.query(
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
        LIMIT 1
        `,
        [emergencyCaseId],
      );

    if (
      emergencyCaseResult.rows.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Emergency case not found",
      });
    }

    const emergencyCase =
      emergencyCaseResult.rows[0];

    /*
     * -------------------------------------------------------
     * 2. Hospital-level authorization
     * -------------------------------------------------------
     */

    if (
      Number(emergencyCase.hospital_id) !==
      Number(req.user.hospitalId)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have access to this emergency case",
      });
    }

    /*
     * -------------------------------------------------------
     * 3. ECIS should normally be used while the identity
     *    is still unresolved.
     * -------------------------------------------------------
     */

    if (!emergencyCase.unidentified_patient) {
      return res.status(400).json({
        success: false,
        message:
          "ECIS search is only available for unidentified emergency cases",
      });
    }

    /*
     * -------------------------------------------------------
     * 4. Remove operational field from search criteria
     * -------------------------------------------------------
     */

    const {
      emergencyCaseId: _emergencyCaseId,
      ...searchCriteria
    } = criteria;

    /*
     * -------------------------------------------------------
     * 5. Search only within the authenticated user's hospital
     * -------------------------------------------------------
     */

    const candidates =
      await ecisService.searchCandidates(
        searchCriteria,
        req.user.hospitalId,
      );

    /*
     * -------------------------------------------------------
     * 6. Record search audit log
     * -------------------------------------------------------
     */

    await pool.query(
      `
      INSERT INTO public.ecis_search_logs (
        emergency_case_id,
        searched_by,
        search_criteria,
        result_count
      )
      VALUES ($1, $2, $3, $4)
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
      message:
        "ECIS candidate search completed successfully",
      emergencyCase: {
        emergencyCaseId:
          emergencyCase.emergency_case_id,
        caseNumber:
          emergencyCase.case_number,
        hospitalId:
          emergencyCase.hospital_id,
        status:
          emergencyCase.status,
      },
      resultCount: candidates.length,
      candidates,
    });
  } catch (error) {
    console.error(
      "ECIS search error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to perform ECIS candidate search",
      error: error.message,
    });
  }
};

module.exports = {
  searchECISCandidates,
};