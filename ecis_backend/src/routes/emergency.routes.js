const express = require("express");

const {
  createEmergencyCase,
  getEmergencyCases,
  getEmergencyCaseById,
} = require("../controllers/emergency.controller");

const router = express.Router();

router.post("/", createEmergencyCase);

router.get("/", getEmergencyCases);

router.get("/:emergencyCaseId", getEmergencyCaseById);

module.exports = router;
