const admissionService = require("../services/admission.service");

function getAuthenticatedHospitalId(req) {
  const hospitalId = Number(
    req.user?.hospitalId,
  );

  if (
    !Number.isInteger(hospitalId) ||
    hospitalId <= 0
  ) {
    return null;
  }

  return hospitalId;
}

function getAuthenticatedUserId(req) {
  const userId = Number(
    req.user?.userId,
  );

  if (
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return null;
  }

  return userId;
}

function parsePositiveInteger(value) {
  const parsed = Number(value);

  return Number.isInteger(parsed) &&
    parsed > 0
    ? parsed
    : null;
}

function sendAdmissionConflict(
  res,
  error,
) {
  return res.status(409).json({
    success: false,
    message:
      error?.message ||
      "Admission operation could not be completed.",
  });
}

async function createAdmission(
  req,
  res,
  next,
) {
  try {
    const authenticatedHospitalId =
      getAuthenticatedHospitalId(req);

    if (!authenticatedHospitalId) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated hospital information is missing.",
      });
    }

    const {
      patientId,
      wardId,
      bedId,
      admissionNumber,
      admissionDate,
      admissionReason,
      admissionDiagnosis,
      attendingDoctorId,
    } = req.body;

    const parsedPatientId =
      parsePositiveInteger(patientId);

    const parsedWardId =
      parsePositiveInteger(wardId);

    const parsedBedId =
      parsePositiveInteger(bedId);

    if (!parsedPatientId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid patientId is required.",
      });
    }

    if (!parsedWardId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid wardId is required.",
      });
    }

    if (!parsedBedId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid bedId is required.",
      });
    }

    if (
      !admissionNumber ||
      !String(admissionNumber).trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "admissionNumber is required.",
      });
    }

    const result =
      await admissionService.createAdmission({
        patientId:
          parsedPatientId,

        hospitalId:
          authenticatedHospitalId,

        wardId:
          parsedWardId,

        bedId:
          parsedBedId,

        admissionNumber:
          String(
            admissionNumber,
          ).trim(),

        admissionDate:
          admissionDate || null,

        admissionReason:
          admissionReason || null,

        admissionDiagnosis:
          admissionDiagnosis || null,

        attendingDoctorId:
          attendingDoctorId
            ? parsePositiveInteger(
                attendingDoctorId,
              )
            : null,
      });

    return res.status(201).json({
      success: true,
      message:
        "Patient admitted successfully.",
      data: result,
    });
  } catch (error) {
    if (
      error?.code === "23505"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "An admission with this admission number already exists.",
      });
    }

    if (
      error?.message ===
        "Active patient not found for the selected hospital" ||
      error?.message ===
        "Active ward not found for the selected hospital" ||
      error?.message ===
        "Selected bed does not belong to the selected ward" ||
      error?.message?.startsWith(
        "Selected bed is not available",
      ) ||
      error?.message ===
        "Patient already has an active admission"
    ) {
      return sendAdmissionConflict(
        res,
        error,
      );
    }

    next(error);
  }
}


/**
 * Create an inpatient admission from an identified
 * emergency case.
 *
 * POST:
 *
 * /api/admissions/from-emergency/:emergencyCaseId
 */
async function createEmergencyAdmission(
  req,
  res,
  next,
) {
  try {
    const hospitalId =
      getAuthenticatedHospitalId(req);

    const userId =
      getAuthenticatedUserId(req);

    if (!hospitalId || !userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated hospital information is missing.",
      });
    }

    const emergencyCaseId =
      parsePositiveInteger(
        req.params.emergencyCaseId,
      );

    if (!emergencyCaseId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid emergencyCaseId is required.",
      });
    }

    const wardId =
      parsePositiveInteger(
        req.body.wardId,
      );

    const bedId =
      parsePositiveInteger(
        req.body.bedId,
      );

    if (!wardId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid wardId is required.",
      });
    }

    if (!bedId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid bedId is required.",
      });
    }

    const result =
      await admissionService.createEmergencyAdmission({
        emergencyCaseId,

        hospitalId,

        wardId,

        bedId,

        admissionNumber:
          req.body.admissionNumber ||
          null,

        admissionDate:
          req.body.admissionDate ||
          null,

        admissionReason:
          req.body.admissionReason ||
          null,

        admissionDiagnosis:
          req.body.admissionDiagnosis ||
          null,

        attendingDoctorId:
          req.body.attendingDoctorId
            ? parsePositiveInteger(
                req.body.attendingDoctorId,
              )
            : userId,
      });

    return res.status(201).json({
      success: true,
      message:
        "Emergency patient admitted successfully.",
      data: result,
    });
  } catch (error) {
    if (
      error?.code === "23505"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "The patient, admission number, or selected bed is already involved in an active admission.",
      });
    }

    const conflictMessages = [
      "Emergency case not found",
      "must be identified",
      "discharged emergency case",
      "Identified patient was not found",
      "already has an active admission",
      "Active ward not found",
      "emergency department bed",
      "Selected admission bed",
      "selected admission bed is not available",
      "already the emergency case",
      "Unable to mark the admission bed",
      "Unable to release the previous emergency bed",
    ];

    const isKnownConflict =
      conflictMessages.some(
        (message) =>
          error?.message
            ?.toLowerCase()
            .includes(
              message.toLowerCase(),
            ),
      );

    if (isKnownConflict) {
      return sendAdmissionConflict(
        res,
        error,
      );
    }

    next(error);
  }
}


/**
 * Discharge an inpatient.
 *
 * POST:
 *
 * /api/admissions/:admissionId/discharge
 */
async function dischargeAdmission(
  req,
  res,
  next,
) {
  try {
    const hospitalId =
      getAuthenticatedHospitalId(req);

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

    const dischargeDiagnosis =
      req.body?.dischargeDiagnosis == null
        ? ""
        : String(
            req.body.dischargeDiagnosis,
          ).trim();

    const dischargeSummary =
      req.body?.dischargeSummary == null
        ? ""
        : String(
            req.body.dischargeSummary,
          ).trim();

    if (!dischargeDiagnosis) {
      return res.status(400).json({
        success: false,
        message:
          "dischargeDiagnosis is required.",
      });
    }

    if (!dischargeSummary) {
      return res.status(400).json({
        success: false,
        message:
          "dischargeSummary is required.",
      });
    }

    const result =
      await admissionService.dischargeAdmission({
        hospitalId,

        admissionId,

        dischargeDiagnosis,

        dischargeSummary,
      });

    return res.status(200).json({
      success: true,
      message:
        "Patient discharged successfully.",
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
        "cannot be discharged",
      ) ||
      message.includes(
        "Admission bed",
      ) ||
      message.includes(
        "encounter could not be found",
      ) ||
      message.includes(
        "encounter cannot be completed",
      ) ||
      message.includes(
        "active emergency location bed",
      ) ||
      message.includes(
        "release the admission bed",
      )
    ) {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    next(error);
  }
}


async function getPatientAdmissions(
  req,
  res,
  next,
) {
  try {
    const hospitalId =
      getAuthenticatedHospitalId(req);

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

    const admissions =
      await admissionService.getPatientAdmissions(
        hospitalId,
        patientId,
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


async function getAdmissionById(
  req,
  res,
  next,
) {
  try {
    const hospitalId =
      getAuthenticatedHospitalId(req);

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

    const admission =
      await admissionService.getAdmissionById(
        hospitalId,
        admissionId,
      );

    if (!admission) {
      return res.status(404).json({
        success: false,
        message:
          "Admission not found.",
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
  createEmergencyAdmission,
  getPatientAdmissions,
  getAdmissionById,
  dischargeAdmission,
};