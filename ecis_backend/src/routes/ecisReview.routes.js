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
} = require("../middleware/authorization.middleware");


/*
 * ============================================================
 * ECIS CANDIDATE REVIEWS
 * ============================================================
 *
 * Routes are mounted from app.js as:
 *
 * /api/ecis
 *
 * Therefore the final endpoints are:
 *
 * POST /api/ecis/reviews
 * GET  /api/ecis/reviews/emergency/:emergencyCaseId
 * GET  /api/ecis/reviews/:reviewId
 *
 * Authentication and doctor authorization are handled here.
 */


/*
 * Create a candidate review.
 *
 * Allowed review decisions:
 *   REJECTED
 *   NEEDS_MORE_EVIDENCE
 *
 * Identity confirmation is intentionally handled
 * by the separate ECIS confirmation workflow.
 */
router.post(
  "/reviews",
  authenticate,
  authorizeRoles("DOCTOR"),
  createCandidateReview,
);


/*
 * Get all reviews belonging to an emergency case.
 */
router.get(
  "/reviews/emergency/:emergencyCaseId",
  authenticate,
  authorizeRoles("DOCTOR"),
  getReviewsByEmergencyCase,
);


/*
 * Get one review by review ID.
 */
router.get(
  "/reviews/:reviewId",
  authenticate,
  authorizeRoles("DOCTOR"),
  getReviewById,
);


module.exports = router;