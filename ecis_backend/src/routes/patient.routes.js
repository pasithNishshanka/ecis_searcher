const express = require("express");

const { authenticate } = require("../middleware/auth.middleware");

const {
  createPatient,
  getAllPatients,
  getPatientById,
  searchPatients,
  updatePatient,
} = require("../controllers/patient.controller");

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

/*
 * Patient ID.
 *
 * Keep this after /search so Express does not treat
 * "search" as a patient identifier.
 */
router.get("/:patientId", getPatientById);

router.put("/:patientId", updatePatient);

module.exports = router;
