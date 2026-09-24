const express = require("express");

const router = express.Router();

const { searchECISCandidates } = require("../controllers/ecis.controller");

const {
  getCandidateEvidence,
} = require("../controllers/ecisEvidence.controller");

const { validateECISSearch } = require("../middleware/ecis.validation");

const { authenticate } = require("../middleware/auth.middleware");

const { authorizeRoles } = require("../middleware/authorization.middleware");

/*
 * ============================================================
 * ECIS CANDIDATE SEARCH
 * ============================================================
 *
 * POST /api/ecis/search
 *
 * ECIS searches the existing EHR and returns
 * evidence-supported candidate patients.
 *
 * Identity is not automatically confirmed here.
 */
router.post(
  "/search",
  authenticate,
  authorizeRoles("DOCTOR"),
  validateECISSearch,
  searchECISCandidates,
);

/*
 * ============================================================
 * ECIS CANDIDATE LONGITUDINAL EVIDENCE
 * ============================================================
 *
 * GET /api/ecis/candidates/:patientId/evidence
 *
 * This endpoint reads the existing longitudinal EHR
 * evidence for the selected candidate.
 *
 * It does NOT create another patient record.
 */
router.get(
  "/candidates/:patientId/evidence",
  authenticate,
  authorizeRoles("DOCTOR", "NURSE", "ADMIN"),
  getCandidateEvidence,
);

module.exports = router;
