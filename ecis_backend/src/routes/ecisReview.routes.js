const express = require("express");
const router = express.Router();

const {
  createCandidateReview,
  getReviewsByEmergencyCase,
  getReviewById,
} = require("../controllers/ecisReview.controller");

/*
 * Create a review
 */
router.post("/reviews", createCandidateReview);

/*
 * Get all reviews for an emergency case
 */
router.get("/reviews/emergency/:emergencyCaseId", getReviewsByEmergencyCase);

/*
 * Get one review
 */
router.get("/reviews/:reviewId", getReviewById);

module.exports = router;
