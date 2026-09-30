const express = require("express");

const {
  createSurgery,
  getPatientClinicalContext,
  getPatientSurgeries,
  getSurgeryById,
} = require("../controllers/surgery.controller");
const { authorizeRoles } = require("../middleware/authorization.middleware");

const router =
  express.Router();

router.post(
  "/",
  authorizeRoles("DOCTOR", "SURGEON"),
  createSurgery,
);

router.get(
  "/patient/:patientId/context",
  getPatientClinicalContext,
);

router.get(
  "/patient/:patientId",
  getPatientSurgeries,
);

router.get(
  "/:surgeryId",
  getSurgeryById,
);

module.exports = router;
