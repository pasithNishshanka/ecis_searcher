const surgeryService = require('../services/surgery.service');


async function createSurgery(req, res, next) {
  try {
    const {
      patientId,
      encounterId,
      surgeryName,
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'patientId is required',
      });
    }

    if (!encounterId) {
      return res.status(400).json({
        success: false,
        message: 'encounterId is required',
      });
    }

    if (!surgeryName || !surgeryName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'surgeryName is required',
      });
    }

    const surgery =
      await surgeryService.createSurgery(req.body);

    return res.status(201).json({
      success: true,
      message: 'Surgery record created successfully',
      data: surgery,
    });
  } catch (error) {
    next(error);
  }
}


async function getPatientSurgeries(req, res, next) {
  try {
    const { patientId } = req.params;

    const surgeries =
      await surgeryService.getPatientSurgeries(patientId);

    return res.status(200).json({
      success: true,
      count: surgeries.length,
      data: surgeries,
    });
  } catch (error) {
    next(error);
  }
}


async function getSurgeryById(req, res, next) {
  try {
    const { surgeryId } = req.params;

    const surgery =
      await surgeryService.getSurgeryById(surgeryId);

    if (!surgery) {
      return res.status(404).json({
        success: false,
        message: 'Surgery record not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: surgery,
    });
  } catch (error) {
    next(error);
  }
}


module.exports = {
  createSurgery,
  getPatientSurgeries,
  getSurgeryById,
};