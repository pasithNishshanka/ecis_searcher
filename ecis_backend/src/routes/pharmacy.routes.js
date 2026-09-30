const express =
  require("express");

const {
  authenticate,
} =
  require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/authorization.middleware");

const {
  createMedicationOrder,
  getAllMedicationOrders,
  getPatientMedicationOrders,
  getMedicationOrderById,
  dispenseMedication,
  getMedicationDispensations,
  cancelMedicationOrder,
} =
  require("../controllers/pharmacy.controller");


const router =
  express.Router();


/* ============================================================
   AUTHENTICATION
   ============================================================ */

router.use(
  authenticate,
);


/* ============================================================
   MEDICATION ORDERS
   ============================================================ */

/*
 * Create medication order
 */
router.post(
  "/orders",
  authorizeRoles("DOCTOR"),
  createMedicationOrder,
);


/*
 * Get all medication orders
 * for authenticated hospital
 */
router.get(
  "/orders",
  getAllMedicationOrders,
);


/*
 * Get medication history
 * for one patient
 */
router.get(
  "/patients/:patientId/orders",
  getPatientMedicationOrders,
);


/*
 * Get one medication order
 */
router.get(
  "/orders/:medicationOrderId",
  getMedicationOrderById,
);


/* ============================================================
   DISPENSING
   ============================================================ */

/*
 * Dispense medication
 */
router.post(
  "/orders/:medicationOrderId/dispense",
  authorizeRoles("PHARMACIST"),
  dispenseMedication,
);


/*
 * Get dispensing history
 */
router.get(
  "/orders/:medicationOrderId/dispensations",
  getMedicationDispensations,
);


/* ============================================================
   ORDER CONTROL
   ============================================================ */

/*
 * Cancel medication order
 */
router.put(
  "/orders/:medicationOrderId/cancel",
  authorizeRoles("DOCTOR", "PHARMACIST"),
  cancelMedicationOrder,
);


module.exports =
  router;
