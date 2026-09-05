const express = require("express");

const {
  createClinicalObservation,
  getPatientObservations,
  getObservationById,
} = require("../controllers/clinicalObservation.controller");

const router = express.Router();

router.post("/", createClinicalObservation);

router.get("/patient/:patientId", getPatientObservations);

router.get("/:observationId", getObservationById);

module.exports = router;
