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
const { authorizeRoles } = require("../middleware/authorization.middleware");

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
  authorizeRoles("RADIOLOGIST"),
  uploadRadiologyImages,
  uploadOrderImages,
);

router.get(
  "/images/:radiologyImageId/file",
  streamImage,
);

router.post(
  "/orders",
  authorizeRoles("DOCTOR", "NURSE"),
  createOrder,
);

router.put(
  "/orders/:investigationId/report",
  authorizeRoles("RADIOLOGIST"),
  recordReport,
);

router.post(
  "/orders/:investigationId/verify",
  authorizeRoles("RADIOLOGIST"),
  verifyReport,
);

module.exports = router;
