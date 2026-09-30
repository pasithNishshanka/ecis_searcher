const express = require("express");

const {
  authenticate,
} = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/authorization.middleware");

const {
  createTreatment,
  getAllTreatments,
  getPatientTreatments,
  getTreatmentById,
} = require("../controllers/treatment.controller");

const router = express.Router();

router.use(authenticate);

router.post("/", authorizeRoles("DOCTOR", "NURSE"), createTreatment);

// Get all treatment records
router.get("/", getAllTreatments);

// Get treatments for one patient
router.get("/patient/:patientId", getPatientTreatments);

// Get one treatment
router.get("/:treatmentId", getTreatmentById);

module.exports = router;
