const express = require("express");

const {
  createOpdVisit,
  getPatientOpdHistory,
} = require("../controllers/opd.controller");

const router =
  express.Router();

/*
 * Authentication is already applied globally
 * by app.js:
 *
 * app.use("/api", authenticate);
 *
 * Therefore these routes receive req.user.
 */

/*
 * Create a real OPD encounter + OPD visit.
 */
router.post(
  "/visits",
  createOpdVisit,
);

/*
 * Longitudinal OPD history for one patient.
 */
router.get(
  "/patients/:patientId/history",
  getPatientOpdHistory,
);

module.exports = router;