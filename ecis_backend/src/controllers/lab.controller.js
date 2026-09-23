const labService =
  require("../services/lab.service");

async function createLabOrder(
  req,
  res,
  next,
) {
  try {
    const data =
      await labService.createLabOrder(
        req.body || {},
        req.user,
      );

    return res.status(201).json({
      success: true,
      message:
        "Laboratory investigation requested successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function getPatientEncounters(
  req,
  res,
  next,
) {
  try {
    const data =
      await labService.getPatientEncounters(
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

async function getPatientLabOrders(
  req,
  res,
  next,
) {
  try {
    const data =
      await labService.getPatientLabOrders(
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

async function getLabOrderById(
  req,
  res,
  next,
) {
  try {
    const data =
      await labService.getLabOrderById(
        req.params.investigationId,
        req.user.hospitalId,
      );

    if (!data) {
      return res.status(404).json({
        success: false,
        message:
          "Laboratory order not found.",
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

async function recordLabResult(
  req,
  res,
  next,
) {
  try {
    const data =
      await labService.recordLabResult(
        req.params.investigationId,
        req.body || {},
        req.user,
      );

    return res.status(200).json({
      success: true,
      message:
        "Laboratory result recorded successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function verifyLabResult(
  req,
  res,
  next,
) {
  try {
    const data =
      await labService.verifyLabResult(
        req.params.investigationId,
        req.user,
      );

    return res.status(200).json({
      success: true,
      message:
        "Laboratory result verified successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createLabOrder,
  getPatientEncounters,
  getPatientLabOrders,
  getLabOrderById,
  recordLabResult,
  verifyLabResult,
};