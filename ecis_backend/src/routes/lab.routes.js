const express =
  require("express");

const {
  createLabOrder,
  getPatientEncounters,
  getPatientLabOrders,
  getLabOrderById,
  recordLabResult,
  verifyLabResult,
} =
  require(
    "../controllers/lab.controller",
  );

const router =
  express.Router();
const { authorizeRoles } = require("../middleware/authorization.middleware");

router.post(
  "/orders",
  authorizeRoles("DOCTOR", "NURSE"),
  createLabOrder,
);

router.get(
  "/patients/:patientId/encounters",
  getPatientEncounters,
);

router.get(
  "/patients/:patientId/orders",
  getPatientLabOrders,
);

router.get(
  "/orders/:investigationId",
  getLabOrderById,
);

router.put(
  "/orders/:investigationId/result",
  authorizeRoles("LAB_TECHNICIAN"),
  recordLabResult,
);

router.post(
  "/orders/:investigationId/verify",
  authorizeRoles("LAB_TECHNICIAN"),
  verifyLabResult,
);

module.exports = router;
