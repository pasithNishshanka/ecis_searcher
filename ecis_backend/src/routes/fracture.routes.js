const express = require("express");

const {
  createFracture,
  getPatientFractures,
  getFractureById,
} = require("../controllers/fracture.controller");

const router = express.Router();

router.post("/", createFracture);

router.get("/patient/:patientId", getPatientFractures);

router.get("/:fractureId", getFractureById);

module.exports = router;
