const ecisReviewService = require("../services/ecisReview.service");


function getAuthenticatedHospitalId(req) {
  const hospitalId = Number(
    req.user?.hospitalId,
  );

  if (
    !Number.isInteger(hospitalId) ||
    hospitalId <= 0
  ) {
    const error = new Error(
      "Authenticated hospital information is missing.",
    );

    error.statusCode = 401;

    throw error;
  }

  return hospitalId;
}


function getAuthenticatedUserId(req) {
  const userId = Number(
    req.user?.userId,
  );

  if (
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    const error = new Error(
      "Authenticated reviewer information is missing.",
    );

    error.statusCode = 401;

    throw error;
  }

  return userId;
}


/*
 * ============================================================
 * CREATE CANDIDATE REVIEW
 * ============================================================
 */
async function createCandidateReview(
  req,
  res,
  next,
) {
  try {
    const {
      emergencyCaseId,
      patientId,
      reviewStatus,
      reviewReason,
    } = req.body || {};

    const hospitalId =
      getAuthenticatedHospitalId(req);

    const reviewedBy =
      getAuthenticatedUserId(req);

    const result =
      await ecisReviewService.reviewCandidate({
        emergencyCaseId,
        patientId,
        reviewedBy,
        hospitalId,
        reviewStatus,
        reviewReason,
      });

    return res.status(201).json({
      success: true,
      message:
        "ECIS candidate review recorded successfully.",
      data: result,
    });
  } catch (error) {
    const statusCode =
      Number(error?.statusCode);

    if (
      statusCode >= 400 &&
      statusCode < 600
    ) {
      return res.status(statusCode).json({
        success: false,
        message: error.message,
      });
    }

    const message =
      String(
        error?.message || "",
      );

    if (
      message.includes("required") ||
      message.includes("positive integer") ||
      message.includes("Invalid review")
    ) {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    if (
      message.includes("not found") ||
      message.includes("not available")
    ) {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    if (
      message.includes(
        "Only an authenticated doctor",
      ) ||
      message.includes(
        "already been confirmed",
      )
    ) {
      return res.status(403).json({
        success: false,
        message,
      });
    }

    next(error);
  }
}


/*
 * ============================================================
 * GET REVIEWS FOR EMERGENCY CASE
 * ============================================================
 */
async function getReviewsByEmergencyCase(
  req,
  res,
  next,
) {
  try {
    const hospitalId =
      getAuthenticatedHospitalId(req);

    const reviews =
      await ecisReviewService.getReviewsByEmergencyCase(
        req.params.emergencyCaseId,
        hospitalId,
      );

    return res.status(200).json({
      success: true,
      resultCount:
        reviews.length,
      reviews,
    });
  } catch (error) {
    next(error);
  }
}


/*
 * ============================================================
 * GET REVIEW BY ID
 * ============================================================
 */
async function getReviewById(
  req,
  res,
  next,
) {
  try {
    const hospitalId =
      getAuthenticatedHospitalId(req);

    const review =
      await ecisReviewService.getReviewById(
        req.params.reviewId,
        hospitalId,
      );

    if (!review) {
      return res.status(404).json({
        success: false,
        message:
          "ECIS review not found.",
      });
    }

    return res.status(200).json({
      success: true,
      review,
    });
  } catch (error) {
    next(error);
  }
}


module.exports = {
  createCandidateReview,
  getReviewsByEmergencyCase,
  getReviewById,
};