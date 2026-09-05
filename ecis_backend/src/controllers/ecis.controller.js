const ecisService = require("../services/ecis.service");
const pool = require("../config/database");

const searchECISCandidates = async (req, res) => {
  try {
    const criteria = req.body || {};

    /*
     * These values will eventually come from the
     * authenticated user/session.
     *
     * For the current development stage we use
     * request headers / body when available.
     */
    const emergencyCaseId = criteria.emergencyCaseId || null;

    const searchedBy = criteria.searchedBy || null;

    /*
     * Do not store audit/helper fields as search criteria.
     */
    const {
      emergencyCaseId: _emergencyCaseId,
      searchedBy: _searchedBy,
      ...searchCriteria
    } = criteria;

    const candidates = await ecisService.searchCandidates(searchCriteria);

    /*
     * Only create a search log when we have a valid
     * hospital user ID.
     *
     * During the current development phase, searchedBy
     * can be supplied in the request body.
     */
    if (searchedBy) {
      await pool.query(
        `
                INSERT INTO ecis_search_logs (
                    emergency_case_id,
                    searched_by,
                    search_criteria,
                    result_count
                )
                VALUES ($1, $2, $3, $4)
                `,
        [
          emergencyCaseId,
          searchedBy,
          JSON.stringify(searchCriteria),
          candidates.length,
        ],
      );
    }

    return res.status(200).json({
      success: true,
      message: "ECIS candidate search completed successfully",
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
