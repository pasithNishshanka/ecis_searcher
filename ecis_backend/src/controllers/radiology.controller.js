const radiologyService =
  require("../services/radiology.service");

async function getPatientEncounters(
  req,
  res,
  next,
) {
  try {
    const data =
      await radiologyService.getPatientEncounters(
        req.params.patientId,
        req.user.hospitalId,
      );

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function getPatientOrders(
  req,
  res,
  next,
) {
  try {
    const data =
      await radiologyService.getPatientOrders(
        req.params.patientId,
        req.user.hospitalId,
      );

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function getOrderById(
  req,
  res,
  next,
) {
  try {
    const data =
      await radiologyService.getOrderById(
        req.params.investigationId,
        req.user.hospitalId,
      );

    if (!data) {
      return res.status(404).json({
        success: false,
        message:
          "Radiology order not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function createOrder(
  req,
  res,
  next,
) {
  try {
    const data =
      await radiologyService.createOrder(
        req.body || {},
        req.user,
      );

    return res.status(201).json({
      success: true,
      message:
        "Radiology investigation requested successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function recordReport(
  req,
  res,
  next,
) {
  try {
    const data =
      await radiologyService.recordReport(
        req.params.investigationId,
        req.body || {},
        req.user,
      );

    return res.status(200).json({
      success: true,
      message:
        "Radiology report recorded successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function verifyReport(
  req,
  res,
  next,
) {
  try {
    const data =
      await radiologyService.verifyReport(
        req.params.investigationId,
        req.user,
      );

    return res.status(200).json({
      success: true,
      message:
        "Radiology report verified successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPatientEncounters,
  getPatientOrders,
  getOrderById,
  createOrder,
  recordReport,
  verifyReport,
};