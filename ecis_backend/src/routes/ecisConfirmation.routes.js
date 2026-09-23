const express = require("express");
const router = express.Router();

const {
  confirmIdentity,
} = require("../controllers/ecisConfirmation.controller");

const {
  authenticate,
} = require("../middleware/auth.middleware");

const {
  authorizeRoles,
} = require("../middleware/authorization.middleware");

/**
 * POST /api/ecis/confirm
 *
 * Confirms the identity of an unidentified emergency patient
 * after authorized human review of the ECIS candidate.
 *
 * Required body:
 * {
 *   emergencyCaseId: number,
 *   patientId: number,
 *   reviewReason: string
 * }
 */
router.post(
  "/confirm",
  authenticate,
  authorizeRoles("DOCTOR"),
  confirmIdentity
);

module.exports = router;