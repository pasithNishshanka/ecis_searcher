const surgeryService = require("../services/surgery.service");

async function createSurgery(
  req,
  res,
  next,
) {
  try {
    const patientId =
      req.body?.patientId;

    const surgeryName =
      String(
        req.body?.surgeryName ??
          "",
      ).trim();

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message:
          "patientId is required",
      });
    }

    if (!surgeryName) {
      return res.status(400).json({
        success: false,
        message:
          "surgeryName is required",
      });
    }

    const result =
      await surgeryService.createSurgery(
        {
          ...req.body,
          hospitalId:
            req.user?.hospitalId,
          surgeonUserId:
            req.user?.userId,
        },
      );

    return res.status(201).json({
      success: true,
      message:
        "Surgery record created successfully",
      data: result.surgery,
      context: {
        encounter:
          result.encounter,
        admission:
          result.admission,
      },
    });
  } catch (error) {
    if (
      error.message.includes(
        "required",
      ) ||
      error.message.includes(
        "invalid",
      ) ||
      error.message.includes(
        "future",
      ) ||
      error.message.includes(
        "incomplete",
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          error.message,
      });
    }

    if (
      error.message.includes(
        "not belong",
      ) ||
      error.message.includes(
        "not active",
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          error.message,
      });
    }

    next(error);
  }
}

async function getPatientClinicalContext(
  req,
  res,
  next,
) {
  try {
    const context =
      await surgeryService.getPatientClinicalContext(
        req.params.patientId,
        req.user?.hospitalId,
      );

    return res.status(200).json({
      success: true,
      data: context,
    });
  } catch (error) {
    if (
      error.message.includes(
        "not found",
      ) ||
      error.message.includes(
        "incomplete",
      )
    ) {
      return res.status(404).json({
        success: false,
        message:
          error.message,
      });
    }

    next(error);
  }
}

async function getPatientSurgeries(
  req,
  res,
  next,
) {
  try {
    const surgeries =
      await surgeryService.getPatientSurgeries(
        req.params.patientId,
        req.user?.hospitalId,
      );

    return res.status(200).json({
      success: true,
      count: surgeries.length,
      data: surgeries,
    });
  } catch (error) {
    if (
      error.message.includes(
        "incomplete",
      ) ||
      error.message.includes(
        "must be",
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          error.message,
      });
    }

    next(error);
  }
}

async function getSurgeryById(
  req,
  res,
  next,
) {
  try {
    const surgery =
      await surgeryService.getSurgeryById(
        req.params.surgeryId,
        req.user?.hospitalId,
      );

    if (!surgery) {
      return res.status(404).json({
        success: false,
        message:
          "Surgery record not found",
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
  getPatientClinicalContext,
  getPatientSurgeries,
  getSurgeryById,
};