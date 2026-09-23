const pharmacyService =
  require("../services/pharmacy.service");


/* ============================================================
   CREATE MEDICATION ORDER
   ============================================================ */

async function createMedicationOrder(
  req,
  res,
  next,
) {
  try {
    const medicationOrder =
      await pharmacyService.createMedicationOrder(
        req.body || {},
        req.user,
      );

    return res.status(201).json({
      success: true,
      message:
        "Medication order created successfully.",
      data:
        medicationOrder,
    });
  } catch (error) {
    next(error);
  }
}


/* ============================================================
   GET ALL MEDICATION ORDERS
   ============================================================ */

async function getAllMedicationOrders(
  req,
  res,
  next,
) {
  try {
    const orders =
      await pharmacyService.getAllMedicationOrders(
        req.user.hospitalId,
      );

    return res.status(200).json({
      success: true,
      count:
        orders.length,
      data:
        orders,
    });
  } catch (error) {
    next(error);
  }
}


/* ============================================================
   GET PATIENT MEDICATION HISTORY
   ============================================================ */

async function getPatientMedicationOrders(
  req,
  res,
  next,
) {
  try {
    const orders =
      await pharmacyService.getPatientMedicationOrders(
        req.params.patientId,
        req.user.hospitalId,
      );

    return res.status(200).json({
      success: true,
      count:
        orders.length,
      data:
        orders,
    });
  } catch (error) {
    next(error);
  }
}


/* ============================================================
   GET ONE MEDICATION ORDER
   ============================================================ */

async function getMedicationOrderById(
  req,
  res,
  next,
) {
  try {
    const order =
      await pharmacyService.getMedicationOrderById(
        req.params.medicationOrderId,
        req.user.hospitalId,
      );

    if (!order) {
      return res.status(404).json({
        success: false,
        message:
          "Medication order not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data:
        order,
    });
  } catch (error) {
    next(error);
  }
}


/* ============================================================
   DISPENSE MEDICATION
   ============================================================ */

async function dispenseMedication(
  req,
  res,
  next,
) {
  try {
    const dispensation =
      await pharmacyService.dispenseMedication(
        req.params.medicationOrderId,
        req.body || {},
        req.user,
      );

    return res.status(201).json({
      success: true,
      message:
        "Medication dispensed successfully.",
      data:
        dispensation,
    });
  } catch (error) {
    next(error);
  }
}


/* ============================================================
   GET DISPENSATION HISTORY
   ============================================================ */

async function getMedicationDispensations(
  req,
  res,
  next,
) {
  try {
    const dispensations =
      await pharmacyService.getMedicationDispensations(
        req.params.medicationOrderId,
        req.user.hospitalId,
      );

    return res.status(200).json({
      success: true,
      count:
        dispensations.length,
      data:
        dispensations,
    });
  } catch (error) {
    next(error);
  }
}


/* ============================================================
   CANCEL MEDICATION ORDER
   ============================================================ */

async function cancelMedicationOrder(
  req,
  res,
  next,
) {
  try {
    const order =
      await pharmacyService.cancelMedicationOrder(
        req.params.medicationOrderId,
        req.body || {},
        req.user,
      );

    return res.status(200).json({
      success: true,
      message:
        "Medication order cancelled successfully.",
      data:
        order,
    });
  } catch (error) {
    next(error);
  }
}


/* ============================================================
   EXPORTS
   ============================================================ */

module.exports = {
  createMedicationOrder,
  getAllMedicationOrders,
  getPatientMedicationOrders,
  getMedicationOrderById,
  dispenseMedication,
  getMedicationDispensations,
  cancelMedicationOrder,
};