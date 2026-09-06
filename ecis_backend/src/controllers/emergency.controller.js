const emergencyService = require("../services/emergency.service");

async function createEmergencyCase(req, res, next) {
  try {
    const {
      caseNumber,
      unidentifiedPatient,
    } = req.body;

    const hospitalId = Number(req.user.hospitalId);

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "Authenticated hospital context is required",
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

    const result = await emergencyService.createEmergencyCase({
      ...req.body,
      hospitalId,
      assignedDoctorId:
        req.body.assignedDoctorId || req.user.userId,
    });

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
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
}

async function getEmergencyCases(req, res, next) {
  try {
    const cases = await emergencyService.getEmergencyCases(
      Number(req.user.hospitalId),
    );

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

    const emergencyCase = await emergencyService.getEmergencyCaseById(
      emergencyCaseId,
      Number(req.user.hospitalId),
    );

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
