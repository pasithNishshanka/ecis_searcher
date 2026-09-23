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

router.post(
  "/orders",
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
  recordLabResult,
);

router.post(
  "/orders/:investigationId/verify",
  verifyLabResult,
);

module.exports = router;