const express = require("express");

const {
  createClinic,
  getClinicsByHospital,
  createClinicVisit,
  getPatientClinicHistory,
} = require("../controllers/clinic.controller");

const router = express.Router();

// Clinics
router.post("/", createClinic);

router.get("/hospital/:hospitalId", getClinicsByHospital);

// Clinic visits
router.post("/visits", createClinicVisit);

router.get("/visits/patient/:patientId", getPatientClinicHistory);

module.exports = router;
