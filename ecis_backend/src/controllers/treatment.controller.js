const treatmentService = require("../services/treatment.service");

async function createTreatment(req, res, next) {
  try {
    const { patientId, encounterId, treatmentType } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: "patientId is required",
      });
    }

    if (!encounterId) {
      return res.status(400).json({
        success: false,
        message: "encounterId is required",
      });
    }

    if (!treatmentType || !treatmentType.trim()) {
      return res.status(400).json({
        success: false,
        message: "treatmentType is required",
      });
    }

    const treatment = await treatmentService.createTreatment(req.body);

    return res.status(201).json({
      success: true,
      message: "Treatment record created successfully",
      data: treatment,
    });
  } catch (error) {
    next(error);
  }
}

async function getPatientTreatments(req, res, next) {
  try {
    const { patientId } = req.params;

    const treatments = await treatmentService.getPatientTreatments(patientId);

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
    const { treatmentId } = req.params;

    const treatment = await treatmentService.getTreatmentById(treatmentId);

    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: "Treatment record not found",
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
};
