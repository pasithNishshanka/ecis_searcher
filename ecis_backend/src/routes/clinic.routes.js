const express =
  require("express");

const {
  authorizeRoles,
} =
  require(
    "../middleware/authorization.middleware",
  );

const {
  createClinic,
  getClinics,
  getClinicsByHospital,
  createClinicVisit,
  getPatientClinicHistory,
} =
  require(
    "../controllers/clinic.controller",
  );

const router =
  express.Router();


/*
 * Clinic configuration is administrative.
 */
router.post(
  "/",
  authorizeRoles("ADMIN"),
  createClinic,
);


/*
 * Preferred authenticated-hospital endpoint.
 */
router.get(
  "/",
  getClinics,
);


/*
 * Backward-compatible hospital endpoint.
 */
router.get(
  "/hospital/:hospitalId",
  getClinicsByHospital,
);


/*
 * Only a doctor completes a specialty
 * clinic consultation.
 */
router.post(
  "/visits",
  authorizeRoles("DOCTOR"),
  createClinicVisit,
);


/*
 * Patient clinic history.
 */
router.get(
  "/visits/patient/:patientId",
  getPatientClinicHistory,
);


module.exports = router;