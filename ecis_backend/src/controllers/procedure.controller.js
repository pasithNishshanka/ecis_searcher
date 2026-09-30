const procedureService = require("../services/procedure.service");

async function createProcedure(
  req,
  res,
  next,
) {
  try {
    const {
      patientId,
      procedureName,
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message:
          "patientId is required",
      });
    }

    if (
      !procedureName ||
      !procedureName.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "procedureName is required",
      });
    }

    const procedure =
      await procedureService.createProcedure(
        {
          ...req.body,

          hospitalId:
            req.user?.hospitalId,

          performedBy:
            ["DOCTOR", "SURGEON"].includes(String(req.user?.role || "").toUpperCase())
              ? req.user?.userId
              : req.body?.performedBy,
          actorUserId: req.user?.userId,
        },
      );

    return res.status(201).json({
      success: true,
      message:
        "Procedure created successfully",
      data: procedure,
    });
  } catch (error) {
    if (
      error.message ===
      "Patient not found"
    ) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message === "Patient is not registered at this hospital") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (/must be|required|invalid|Encounter does not belong|Select an active doctor/.test(error.message)) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
}

async function getPatientProcedures(
  req,
  res,
  next,
) {
  try {
    const {
      patientId,
    } = req.params;

    const procedures =
      await procedureService.getPatientProcedures(
        patientId,
        req.user?.hospitalId,
      );

    return res.status(200).json({
      success: true,
      count: procedures.length,
      data: procedures,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createProcedure,
  getPatientProcedures,
};
