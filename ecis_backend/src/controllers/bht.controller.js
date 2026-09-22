const bhtService =
  require("../services/bht.service");


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


/* ============================================================
   CREATE BHT ENTRY
   ============================================================ */

async function createBhtEntry(
  req,
  res,
  next,
) {
  try {
    const hospitalId =
      getHospitalId(req);

    const recordedBy =
      getUserId(req);

    if (
      !hospitalId ||
      !recordedBy
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated hospital/user information is missing.",
      });
    }


    const admissionId =
      parsePositiveInteger(
        req.params.admissionId,
      );

    if (!admissionId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid admissionId is required.",
      });
    }


    const result =
      await bhtService.createBhtEntry({
        ...req.body,

        admissionId,

        hospitalId,

        /*
         * Never trust recorder ID
         * from frontend.
         */
        recordedBy,
      });


    return res.status(201).json({
      success: true,

      message:
        "BHT clinical entry recorded successfully.",

      data: result,
    });
  } catch (error) {
    const message =
      error?.message || "";


    if (
      message.includes(
        "Admission not found",
      ) ||
      message.includes(
        "BHT entry cannot be recorded",
      ) ||
      message.includes(
        "Authenticated hospital user",
      ) ||
      message.includes(
        "Only an authenticated doctor",
      )
    ) {
      return res.status(409).json({
        success: false,
        message,
      });
    }


    if (
      message.includes(
        "must be a valid",
      ) ||
      message.includes(
        "must be numeric",
      ) ||
      message.includes(
        "Invalid BHT entry type",
      ) ||
      message.includes(
        "At least one clinical",
      ) ||
      message.includes(
        "entryDate is invalid",
      )
    ) {
      return res.status(400).json({
        success: false,
        message,
      });
    }


    next(error);
  }
}


/* ============================================================
   GET ADMISSION BHT
   ============================================================ */

async function getAdmissionBhtEntries(
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


    const admissionId =
      parsePositiveInteger(
        req.params.admissionId,
      );

    if (!admissionId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid admissionId is required.",
      });
    }


    const entries =
      await bhtService.getAdmissionBhtEntries(
        admissionId,
        hospitalId,
      );


    return res.status(200).json({
      success: true,

      count:
        entries.length,

      data:
        entries,
    });
  } catch (error) {
    next(error);
  }
}


/* ============================================================
   GET PATIENT BHT HISTORY
   ============================================================ */

async function getPatientBhtHistory(
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


    const entries =
      await bhtService.getPatientBhtHistory(
        patientId,
        hospitalId,
      );


    return res.status(200).json({
      success: true,

      count:
        entries.length,

      data:
        entries,
    });
  } catch (error) {
    next(error);
  }
}


module.exports = {
  createBhtEntry,
  getAdmissionBhtEntries,
  getPatientBhtHistory,
};