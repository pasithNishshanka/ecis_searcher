const fractureService = require('../services/fracture.service');


async function createFracture(req, res, next) {
  try {
    const {
      patientId,
      encounterId,
      bodyPart,
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

    if (!bodyPart || !bodyPart.trim()) {
      return res.status(400).json({
        success: false,
        message: 'bodyPart is required',
      });
    }

    const fracture =
      await fractureService.createFracture(req.body);

    return res.status(201).json({
      success: true,
      message: 'Fracture record created successfully',
      data: fracture,
    });
  } catch (error) {
    next(error);
  }
}


async function getPatientFractures(req, res, next) {
  try {
    const { patientId } = req.params;

    const fractures =
      await fractureService.getPatientFractures(patientId);

    return res.status(200).json({
      success: true,
      count: fractures.length,
      data: fractures,
    });
  } catch (error) {
    next(error);
  }
}


async function getFractureById(req, res, next) {
  try {
    const { fractureId } = req.params;

    const fracture =
      await fractureService.getFractureById(fractureId);

    if (!fracture) {
      return res.status(404).json({
        success: false,
        message: 'Fracture record not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: fracture,
    });
  } catch (error) {
    next(error);
  }
}


module.exports = {
  createFracture,
  getPatientFractures,
  getFractureById,
};