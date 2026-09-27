const express =
  require("express");

const {
  getPatientEncounters,
  getPatientOrders,
  getOrderById,
  createOrder,
  recordReport,
  verifyReport,
  uploadOrderImages,
  getOrderImages,
  streamImage,
} =
  require(
    "../controllers/radiology.controller",
  );

const router =
  express.Router();

const {
  uploadRadiologyImages,
} = require(
  "../middleware/radiologyUpload.middleware",
);

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

router.get(
  "/orders/:investigationId/images",
  getOrderImages,
);

router.post(
  "/orders/:investigationId/images",
  uploadRadiologyImages,
  uploadOrderImages,
);

router.get(
  "/images/:radiologyImageId/file",
  streamImage,
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
