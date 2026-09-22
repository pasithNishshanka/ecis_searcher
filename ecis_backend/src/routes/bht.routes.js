const express =
  require("express");

const {
  authorizeRoles,
} =
  require(
    "../middleware/authorization.middleware",
  );

const {
  createBhtEntry,
  getAdmissionBhtEntries,
  getPatientBhtHistory,
} =
  require(
    "../controllers/bht.controller",
  );

const router =
  express.Router();


/*
 * Create a BHT clinical entry.
 *
 * The authenticated doctor comes from JWT.
 */
router.post(
  "/admissions/:admissionId/entries",
  authorizeRoles("DOCTOR"),
  createBhtEntry,
);


/*
 * Complete BHT timeline for one admission.
 */
router.get(
  "/admissions/:admissionId/entries",
  getAdmissionBhtEntries,
);


/*
 * All BHT entries for a patient across admissions.
 */
router.get(
  "/patients/:patientId/entries",
  getPatientBhtHistory,
);


module.exports =
  router;