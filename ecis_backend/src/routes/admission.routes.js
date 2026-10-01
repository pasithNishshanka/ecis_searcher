const express = require("express");
const { authorizeRoles } = require("../middleware/authorization.middleware");

const {
  createAdmission,
  createEmergencyAdmission,
  getPatientAdmissions,
  getAdmissionById,
  dischargeAdmission,
  assignAttendingDoctor,
} = require("../controllers/admission.controller");

const router = express.Router();

/*
 * Authentication is already applied globally
 * in app.js before /api routes.
 */

/*
 * Normal inpatient admission.
 */
router.post(
  "/",
  authorizeRoles("DOCTOR", "NURSE", "ADMIN"),
  createAdmission,
);

/*
 * Emergency -> Ward / ICU admission.
 *
 * The emergency case must already be identified
 * through the ECIS human-verification workflow.
 */
router.post(
  "/from-emergency/:emergencyCaseId",
  authorizeRoles("DOCTOR", "NURSE", "ADMIN"),
  createEmergencyAdmission,
);

router.get(
  "/patient/:patientId",
  getPatientAdmissions,
);

/*
 * Inpatient discharge.
 *
 * IMPORTANT:
 * This route must be registered BEFORE
 * /:admissionId so Express matches it correctly.
 */
router.post(
  "/:admissionId/discharge",
  authorizeRoles("DOCTOR", "ADMIN"),
  dischargeAdmission,
);

router.put(
  "/:admissionId/attending-doctor",
  authorizeRoles("ADMIN", "SYSTEM_ADMIN"),
  assignAttendingDoctor,
);

router.get(
  "/:admissionId",
  getAdmissionById,
);

module.exports = router;
