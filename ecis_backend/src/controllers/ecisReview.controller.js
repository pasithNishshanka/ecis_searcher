const ecisReviewService = require("../services/ecisReview.service");

const createCandidateReview = async (req, res) => {
  try {
    const {
      emergencyCaseId,
      patientId,
      reviewedBy,
      reviewStatus,
      reviewReason,
    } = req.body;

    const result = await ecisReviewService.reviewCandidate({
      emergencyCaseId,
      patientId,
      reviewedBy,
      reviewStatus,
      reviewReason,
    });

    return res.status(201).json({
      success: true,
      message: "ECIS candidate review recorded successfully",
      data: result,
    });
  } catch (error) {
    console.error("Create ECIS review error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getReviewsByEmergencyCase = async (req, res) => {
  try {
    const { emergencyCaseId } = req.params;

    const reviews =
      await ecisReviewService.getReviewsByEmergencyCase(emergencyCaseId);

    return res.status(200).json({
      success: true,
      resultCount: reviews.length,
      reviews,
    });
  } catch (error) {
    console.error("Get ECIS reviews error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve ECIS reviews",
      error: error.message,
    });
  }
};

const getReviewById = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await ecisReviewService.getReviewById(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "ECIS review not found",
      });
    }

    return res.status(200).json({
      success: true,
      review,
    });
  } catch (error) {
    console.error("Get ECIS review error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve ECIS review",
      error: error.message,
    });
  }
};

module.exports = {
  createCandidateReview,
  getReviewsByEmergencyCase,
  getReviewById,
};
