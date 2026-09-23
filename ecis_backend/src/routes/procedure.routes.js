const express = require("express");

const {
  createProcedure,
  getPatientProcedures,
} = require("../controllers/procedure.controller");

const {
  authorizeRoles,
} = require("../middleware/authorization.middleware");

const router =
  express.Router();

router.post(
  "/",
  authorizeRoles("DOCTOR"),
  createProcedure,
);

router.get(
  "/patient/:patientId",
  getPatientProcedures,
);

module.exports = router;