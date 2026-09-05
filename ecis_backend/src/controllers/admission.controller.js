const admissionService = require('../services/admission.service');


async function createAdmission(req, res, next) {
  try {
    const {
      patientId,
      hospitalId,
      wardId,
      bedId,
      admissionNumber,
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'patientId is required',
      });
    }

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: 'hospitalId is required',
      });
    }

    if (!wardId) {
      return res.status(400).json({
        success: false,
        message: 'wardId is required',
      });
    }

    if (!bedId) {
      return res.status(400).json({
        success: false,
        message: 'bedId is required',
      });
    }

    if (
      !admissionNumber ||
      !admissionNumber.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'admissionNumber is required',
      });
    }

    const result =
      await admissionService.createAdmission(
        req.body
      );

    return res.status(201).json({
      success: true,
      message: 'Patient admitted successfully',
      data: result,
    });

  } catch (error) {
    // Business-rule errors
    if (
      error.message.includes('not found') ||
      error.message.includes('not available') ||
      error.message.includes('already has')
    ) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
}


async function getPatientAdmissions(req, res, next) {
  try {
    const { patientId } = req.params;

    const admissions =
      await admissionService.getPatientAdmissions(
        patientId
      );

    return res.status(200).json({
      success: true,
      count: admissions.length,
      data: admissions,
    });

  } catch (error) {
    next(error);
  }
}


async function getAdmissionById(req, res, next) {
  try {
    const { admissionId } = req.params;

    const admission =
      await admissionService.getAdmissionById(
        admissionId
      );

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: admission,
    });

  } catch (error) {
    next(error);
  }
}


module.exports = {
  createAdmission,
  getPatientAdmissions,
  getAdmissionById,
};