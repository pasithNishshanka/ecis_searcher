const express = require("express");

const { authenticate } = require("../middleware/auth.middleware");

const {
  createPatient,
  getAllPatients,
  getPatientById,
  getPatientClinicalContext,
  searchPatients,
  updatePatient,
  registerPatientAtCurrentHospital,
  searchCentralPatients,
} = require("../controllers/patient.controller");

const {
  authorizeRoles,
} = require("../middleware/authorization.middleware");

const router = express.Router();

/*
 * All patient operations require
 * authenticated hospital staff.
 */
router.use(authenticate);

/*
 * Create
 */
router.post("/", createPatient);

/*
 * List
 */
router.get("/", getAllPatients);

/*
 * Search
 */
router.get("/search", searchPatients);

/* Minimum-necessary identity search before registering a central patient. */
router.get(
  "/central-search",
  authorizeRoles("DOCTOR", "ADMIN"),
  searchCentralPatients,
);

/*
 * Register an existing central patient at the authenticated hospital.
 * This creates a hospital registration, not a duplicate patient identity.
 */
router.post(
  "/:patientId/register-at-current-hospital",
  authorizeRoles("DOCTOR", "ADMIN"),
  registerPatientAtCurrentHospital,
);

/* Patient 360 / longitudinal clinical context. */
router.get(
  "/:patientId/clinical-context",
  getPatientClinicalContext,
);

/*
 * Patient ID.
 *
 * Keep this after /search so Express does not treat
 * "search" as a patient identifier.
 */
router.get("/:patientId", getPatientById);

router.put("/:patientId", updatePatient);

module.exports = router;
