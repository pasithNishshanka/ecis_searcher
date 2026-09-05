const express = require("express");

const {
  createTreatment,
  getPatientTreatments,
  getTreatmentById,
} = require("../controllers/treatment.controller");

const router = express.Router();

router.post("/", createTreatment);

router.get("/patient/:patientId", getPatientTreatments);

router.get("/:treatmentId", getTreatmentById);

module.exports = router;
