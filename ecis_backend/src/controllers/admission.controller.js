const admissionService = require("../services/admission.service");

function getAuthenticatedHospitalId(req) {
  const hospitalId = Number(req.user?.hospitalId);

  if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
    return null;
  }

  return hospitalId;
}

function parsePositiveInteger(value) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : null;
}

async function createAdmission(req, res, next) {
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
        message: "A valid patientId is required.",
      });
    }

    if (!parsedWardId) {
      return res.status(400).json({
        success: false,
        message: "A valid wardId is required.",
      });
    }

    if (!parsedBedId) {
      return res.status(400).json({
        success: false,
        message: "A valid bedId is required.",
      });
    }

    if (
      !admissionNumber ||
      !String(admissionNumber).trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "admissionNumber is required.",
      });
    }

    const result =
      await admissionService.createAdmission({
        patientId: parsedPatientId,
        hospitalId: authenticatedHospitalId,
        wardId: parsedWardId,
        bedId: parsedBedId,
        admissionNumber: String(
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
      message: "Patient admitted successfully.",
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
      return res.status(409).json({
        success: false,
        message: error.message,
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
        message: "A valid patientId is required.",
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
        message: "Admission not found.",
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