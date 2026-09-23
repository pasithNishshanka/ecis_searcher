const express =
  require("express");


const {
  getPatientMedicalRecord,
} =
  require(
    "../controllers/medicalRecord.controller",
  );


const router =
  express.Router();


/*
 * Complete longitudinal EHR
 * for one authenticated-hospital patient.
 */
router.get(
  "/patients/:patientId",
  getPatientMedicalRecord,
);


module.exports =
  router;