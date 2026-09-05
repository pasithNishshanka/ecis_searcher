const express = require("express");

const router = express.Router();

const {
  createCandidateReview,
  getReviewsByEmergencyCase,
  getReviewById,
} = require("../controllers/ecisReview.controller");

const {
  authenticate,
} = require("../middleware/auth.middleware");

const {
  authorizeRoles,
} = require(
  "../middleware/authorization.middleware",
);

/*
 * Create candidate review.
 *
 * DOCTOR can reject a candidate or request
 * additional evidence.
 */
router.post(
  "/reviews",
  authenticate,
  authorizeRoles("DOCTOR"),
  createCandidateReview,
);

/*
 * Get reviews for an emergency case.
 */
router.get(
  "/reviews/emergency/:emergencyCaseId",
  authenticate,
  authorizeRoles("DOCTOR"),
  getReviewsByEmergencyCase,
);

/*
 * Get a specific review.
 */
router.get(
  "/reviews/:reviewId",
  authenticate,
  authorizeRoles("DOCTOR"),
  getReviewById,
);

module.exports = router;