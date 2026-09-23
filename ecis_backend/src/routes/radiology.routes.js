const express =
  require("express");

const {
  getPatientEncounters,
  getPatientOrders,
  getOrderById,
  createOrder,
  recordReport,
  verifyReport,
} =
  require(
    "../controllers/radiology.controller",
  );

const router =
  express.Router();

router.get(
  "/patients/:patientId/encounters",
  getPatientEncounters,
);

router.get(
  "/patients/:patientId/orders",
  getPatientOrders,
);

router.get(
  "/orders/:investigationId",
  getOrderById,
);

router.post(
  "/orders",
  createOrder,
);

router.put(
  "/orders/:investigationId/report",
  recordReport,
);

router.post(
  "/orders/:investigationId/verify",
  verifyReport,
);

module.exports = router;