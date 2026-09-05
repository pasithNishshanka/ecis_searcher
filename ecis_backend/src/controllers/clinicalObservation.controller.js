const observationService = require("../services/clinicalObservation.service");

async function createClinicalObservation(req, res, next) {
  try {
    const { patientId, encounterId, observationType, observationValue } =
      req.body;

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

    if (!observationType || !observationType.trim()) {
      return res.status(400).json({
        success: false,
        message: "observationType is required",
      });
    }

    if (!observationValue || !observationValue.trim()) {
      return res.status(400).json({
        success: false,
        message: "observationValue is required",
      });
    }

    const observation = await observationService.createClinicalObservation(
      req.body,
    );

    return res.status(201).json({
      success: true,
      message: "Clinical observation created successfully",
      data: observation,
    });
  } catch (error) {
    next(error);
  }
}

async function getPatientObservations(req, res, next) {
  try {
    const { patientId } = req.params;

    const observations =
      await observationService.getPatientObservations(patientId);

    return res.status(200).json({
      success: true,
      count: observations.length,
      data: observations,
    });
  } catch (error) {
    next(error);
  }
}

async function getObservationById(req, res, next) {
  try {
    const { observationId } = req.params;

    const observation =
      await observationService.getObservationById(observationId);

    if (!observation) {
      return res.status(404).json({
        success: false,
        message: "Clinical observation not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: observation,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createClinicalObservation,
  getPatientObservations,
  getObservationById,
};
