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

/*
 * Emergency clinical operations are currently restricted
 * to doctors, matching the existing project authorization.
 */
router.use(
  authorizeRoles("DOCTOR"),
);

/*
 * ------------------------------------------------------------
 * Emergency case CRUD
 * ------------------------------------------------------------
 */

router.post(
  "/",
  createEmergencyCase,
);

router.get(
  "/",
  getEmergencyCases,
);

router.get(
  "/:emergencyCaseId",
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
  assignEmergencyLocation,
);

router.post(
  "/:emergencyCaseId/location/transfer",
  transferEmergencyLocation,
);

router.get(
  "/:emergencyCaseId/location",
  getEmergencyCaseLocation,
);

router.get(
  "/:emergencyCaseId/location/history",
  getEmergencyCaseLocationHistory,
);

router.post(
  "/:emergencyCaseId/discharge",
  dischargeEmergencyCase,
);

module.exports = router;