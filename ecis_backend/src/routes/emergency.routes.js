const express = require("express");

const {
  createEmergencyCase,
  getEmergencyCases,
  getEmergencyCaseById,
  assignEmergencyLocation,
  transferEmergencyLocation,
  dischargeEmergencyCase,
  getEmergencyCaseLocation,
  getEmergencyCaseLocationHistory,
} = require("../controllers/emergency.controller");

const {
  authenticate,
} = require("../middleware/auth.middleware");

const {
  authorizeRoles,
} = require("../middleware/authorization.middleware");

const router = express.Router();

/*
 * Emergency routes require authentication.
 */
router.use(authenticate);

const canViewEmergency = authorizeRoles(
  "DOCTOR",
  "NURSE",
  "ADMIN",
  "HOSPITAL_ADMIN",
  "SYSTEM_ADMIN",
);

const canManageEmergency = authorizeRoles("DOCTOR");

/*
 * ------------------------------------------------------------
 * Emergency case CRUD
 * ------------------------------------------------------------
 */

router.post(
  "/",
  canManageEmergency,
  createEmergencyCase,
);

router.get(
  "/",
  canViewEmergency,
  getEmergencyCases,
);

router.get(
  "/:emergencyCaseId",
  canViewEmergency,
  getEmergencyCaseById,
);

/*
 * ------------------------------------------------------------
 * Emergency location
 * ------------------------------------------------------------
 *
 * Assign:
 *
 * POST
 * /api/emergency/:emergencyCaseId/location
 *
 * Transfer:
 *
 * POST
 * /api/emergency/:emergencyCaseId/location/transfer
 *
 * Current location:
 *
 * GET
 * /api/emergency/:emergencyCaseId/location
 *
 * History:
 *
 * GET
 * /api/emergency/:emergencyCaseId/location/history
 *
 * Discharge:
 *
 * POST
 * /api/emergency/:emergencyCaseId/discharge
 */

router.post(
  "/:emergencyCaseId/location",
  canManageEmergency,
  assignEmergencyLocation,
);

router.post(
  "/:emergencyCaseId/location/transfer",
  canManageEmergency,
  transferEmergencyLocation,
);

router.get(
  "/:emergencyCaseId/location",
  canViewEmergency,
  getEmergencyCaseLocation,
);

router.get(
  "/:emergencyCaseId/location/history",
  canViewEmergency,
  getEmergencyCaseLocationHistory,
);

router.post(
  "/:emergencyCaseId/discharge",
  canManageEmergency,
  dischargeEmergencyCase,
);

module.exports = router;
