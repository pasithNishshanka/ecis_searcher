const express = require("express");

const {
  createTreatment,
  getAllTreatments,
  getPatientTreatments,
  getTreatmentById,
} = require("../controllers/treatment.controller");

const router = express.Router();

router.post("/", createTreatment);

// Get all treatment records
router.get("/", getAllTreatments);

// Get treatments for one patient
router.get("/patient/:patientId", getPatientTreatments);

// Get one treatment
router.get("/:treatmentId", getTreatmentById);

module.exports = router;