const treatmentService = require("../services/treatment.service");

async function createTreatment(req, res, next) {
  try {
    const treatment = await treatmentService.createTreatment(
      req.body || {},
      req.user,
    );

    return res.status(201).json({
      success: true,
      message: "Treatment record created successfully.",
      data: treatment,
    });
  } catch (error) {
    next(error);
  }
}

async function getAllTreatments(req, res, next) {
  try {
    const treatments = await treatmentService.getAllTreatments(
      req.user.hospitalId,
    );

    return res.status(200).json({
      success: true,
      count: treatments.length,
      data: treatments,
    });
  } catch (error) {
    next(error);
  }
}

async function getPatientTreatments(req, res, next) {
  try {
    const treatments = await treatmentService.getPatientTreatments(
      req.params.patientId,
      req.user.hospitalId,
    );

    return res.status(200).json({
      success: true,
      count: treatments.length,
      data: treatments,
    });
  } catch (error) {
    next(error);
  }
}

async function getTreatmentById(req, res, next) {
  try {
    const treatment = await treatmentService.getTreatmentById(
      req.params.treatmentId,
      req.user.hospitalId,
    );

    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: "Treatment record not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: treatment,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createTreatment,
  getPatientTreatments,
  getTreatmentById,
  getAllTreatments,
};
