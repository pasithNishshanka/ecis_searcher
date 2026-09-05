const investigationService = require("../services/investigation.service");

async function createInvestigation(req, res, next) {
  try {
    const { patientId, encounterId, investigationType, investigationName } =
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

    if (!investigationType || !investigationType.trim()) {
      return res.status(400).json({
        success: false,
        message: "investigationType is required",
      });
    }

    if (!investigationName || !investigationName.trim()) {
      return res.status(400).json({
        success: false,
        message: "investigationName is required",
      });
    }

    const investigation = await investigationService.createInvestigation(
      req.body,
    );

    return res.status(201).json({
      success: true,
      message: "Investigation created successfully",
      data: investigation,
    });
  } catch (error) {
    next(error);
  }
}

async function getPatientInvestigations(req, res, next) {
  try {
    const { patientId } = req.params;

    const investigations =
      await investigationService.getPatientInvestigations(patientId);

    return res.status(200).json({
      success: true,
      count: investigations.length,
      data: investigations,
    });
  } catch (error) {
    next(error);
  }
}

async function getInvestigationById(req, res, next) {
  try {
    const { investigationId } = req.params;

    const investigation =
      await investigationService.getInvestigationById(investigationId);

    if (!investigation) {
      return res.status(404).json({
        success: false,
        message: "Investigation not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: investigation,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createInvestigation,
  getPatientInvestigations,
  getInvestigationById,
};
