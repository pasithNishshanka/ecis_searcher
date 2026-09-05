const express = require("express");

const {
  createCondition,
  getAllConditions,
  addPatientCondition,
  getPatientConditions,
  getPatientConditionById,
} = require("../controllers/condition.controller");

const router = express.Router();

// Medical condition master data
router.post("/", createCondition);

router.get("/", getAllConditions);

// Patient diagnoses
router.post("/patient", addPatientCondition);

router.get("/patient/:patientId", getPatientConditions);

router.get("/patient-record/:patientConditionId", getPatientConditionById);

module.exports = router;
