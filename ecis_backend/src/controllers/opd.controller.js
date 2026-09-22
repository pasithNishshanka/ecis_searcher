const opdService = require("../services/opd.service");

function getHospitalId(req) {
  const hospitalId =
    Number(
      req.user?.hospitalId,
    );

  return Number.isInteger(
    hospitalId,
  ) && hospitalId > 0
    ? hospitalId
    : null;
}

function getUserId(req) {
  const userId =
    Number(
      req.user?.userId,
    );

  return Number.isInteger(
    userId,
  ) && userId > 0
    ? userId
    : null;
}

function parsePositiveInteger(
  value,
) {
  const parsed =
    Number(value);

  return Number.isInteger(
    parsed,
  ) && parsed > 0
    ? parsed
    : null;
}

async function createOpdVisit(
  req,
  res,
  next,
) {
  try {
    const hospitalId =
      getHospitalId(req);

    const doctorUserId =
      getUserId(req);

    if (!hospitalId) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated hospital information is missing.",
      });
    }

    if (!doctorUserId) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated user information is missing.",
      });
    }

    const patientId =
      parsePositiveInteger(
        req.body?.patientId,
      );

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid patientId is required.",
      });
    }

    const result =
      await opdService.createOpdVisit({
        ...req.body,

        patientId,

        hospitalId,

        /*
         * Never trust doctorUserId from frontend.
         * The authenticated user is authoritative.
         */
        doctorUserId,
      });

    return res.status(201).json({
      success: true,
      message:
        "OPD visit created successfully.",
      data: result,
    });
  } catch (error) {
    if (
      error?.code ===
      "23505"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "An OPD visit with this OPD number already exists.",
      });
    }

    if (
      error?.message ===
        "Active patient not found for the authenticated hospital." ||
      error?.message ===
        "Authenticated hospital user is not active in this hospital."
    ) {
      return res.status(409).json({
        success: false,
        message:
          error.message,
      });
    }

    if (
      error?.message ===
        "Chief complaint is required." ||
      error?.message ===
        "Diagnosis summary is required." ||
      error?.message ===
        "Follow-up date is required when follow-up is selected." ||
      error?.message ===
        "Invalid OPD visit date."
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

async function getPatientOpdHistory(
  req,
  res,
  next,
) {
  try {
    const hospitalId =
      getHospitalId(req);

    if (!hospitalId) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated hospital information is missing.",
      });
    }

    const patientId =
      parsePositiveInteger(
        req.params.patientId,
      );

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid patientId is required.",
      });
    }

    const history =
      await opdService.getPatientOpdHistory(
        patientId,
        hospitalId,
      );

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