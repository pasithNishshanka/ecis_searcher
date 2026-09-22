const express = require("express");

const {
  createAdmission,
  createEmergencyAdmission,
  getPatientAdmissions,
  getAdmissionById,
  dischargeAdmission,
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
  dischargeAdmission,
);

router.get(
  "/:admissionId",
  getAdmissionById,
);

module.exports = router;