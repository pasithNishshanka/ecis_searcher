const emergencyService = require("../services/emergency.service");

async function createEmergencyCase(req, res, next) {
  try {
    const { hospitalId, caseNumber, unidentifiedPatient } = req.body;

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "hospitalId is required",
      });
    }

    if (!caseNumber || !caseNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: "caseNumber is required",
      });
    }

    if (typeof unidentifiedPatient !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "unidentifiedPatient must be boolean",
      });
    }

    const result = await emergencyService.createEmergencyCase(req.body);

    return res.status(201).json({
      success: true,
      message: "Emergency case created successfully",
      data: result,
    });
  } catch (error) {
    if (
      error.message.includes("required") ||
      error.message.includes("cannot have") ||
      error.message.includes("not found")
    ) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
}

async function getEmergencyCases(req, res, next) {
  try {
    const cases = await emergencyService.getEmergencyCases();

    return res.status(200).json({
      success: true,
      count: cases.length,
      data: cases,
    });
  } catch (error) {
    next(error);
  }
}

async function getEmergencyCaseById(req, res, next) {
  try {
    const { emergencyCaseId } = req.params;

    const emergencyCase =
      await emergencyService.getEmergencyCaseById(emergencyCaseId);

    if (!emergencyCase) {
      return res.status(404).json({
        success: false,
        message: "Emergency case not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: emergencyCase,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createEmergencyCase,
  getEmergencyCases,
  getEmergencyCaseById,
};
