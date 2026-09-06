const express = require("express");

const {
  createEmergencyCase,
  getEmergencyCases,
  getEmergencyCaseById,
} = require("../controllers/emergency.controller");

const { authenticate } = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/authorization.middleware");

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles("DOCTOR"));

router.post("/", createEmergencyCase);
router.get("/", getEmergencyCases);
router.get("/:emergencyCaseId", getEmergencyCaseById);

module.exports = router;
