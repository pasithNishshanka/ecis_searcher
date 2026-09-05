const ecisService = require("../services/ecis.service");

const searchECISCandidates = async (req, res) => {
  try {
    const criteria = req.body || {};

    const candidates = await ecisService.searchCandidates(criteria);

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
