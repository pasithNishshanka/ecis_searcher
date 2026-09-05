const opdService = require("../services/opd.service");

async function createOpdVisit(req, res, next) {
  try {
    const { patientId, hospitalId, opdNumber } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: "patientId is required",
      });
    }

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "hospitalId is required",
      });
    }

    if (!opdNumber || !opdNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: "opdNumber is required",
      });
    }

    const result = await opdService.createOpdVisit(req.body);

    return res.status(201).json({
      success: true,
      message: "OPD visit created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function getPatientOpdHistory(req, res, next) {
  try {
    const { patientId } = req.params;

    const history = await opdService.getPatientOpdHistory(patientId);

    return res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createOpdVisit,
  getPatientOpdHistory,
};
