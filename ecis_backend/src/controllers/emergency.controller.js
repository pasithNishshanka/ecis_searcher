const emergencyService = require("../services/emergency.service");

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

function sendServiceError(
  res,
  error,
) {
  const message =
    error?.message ||
    "Emergency operation failed.";

  const conflictMessages = [
    "already has an active location",
    "already discharged",
    "not available",
    "does not currently have",
    "cannot be assigned",
    "cannot be transferred",
    "already identified",
    "already associated",
    "not found",
  ];

  const isConflict =
    conflictMessages.some(
      (item) =>
        message
          .toLowerCase()
          .includes(item.toLowerCase()),
    );

  return res.status(
    isConflict ? 409 : 400,
  ).json({
    success: false,
    message,
  });
}

async function createEmergencyCase(
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

    const {
      caseNumber,
      unidentifiedPatient,
    } = req.body;

    if (
      !caseNumber ||
      !String(caseNumber).trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "caseNumber is required.",
      });
    }

    if (
      typeof unidentifiedPatient !==
      "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "unidentifiedPatient must be boolean.",
      });
    }

    const result =
      await emergencyService.createEmergencyCase({
        ...req.body,
        hospitalId,
        assignedDoctorId:
          req.body.assignedDoctorId ||
          userId,
      });

    return res.status(201).json({
      success: true,
      message:
        "Emergency case created successfully.",
      data: result,
    });
  } catch (error) {
    if (
      error?.code === "23505"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "An emergency case with this case number already exists.",
      });
    }

    if (
      error?.code === "23514"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Emergency case contains a value that violates a database rule.",
        detail:
          error?.detail || null,
      });
    }

    if (
      error?.message
        ?.toLowerCase()
        .includes("required") ||
      error?.message
        ?.toLowerCase()
        .includes("cannot have") ||
      error?.message
        ?.toLowerCase()
        .includes("not found") ||
      error?.message
        ?.toLowerCase()
        .includes("invalid emergency status")
    ) {
      return sendServiceError(
        res,
        error,
      );
    }

    next(error);
  }
}

async function getEmergencyCases(
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
          "Authenticated hospital context is required.",
      });
    }

    const cases =
      await emergencyService.getEmergencyCases(
        hospitalId,
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

async function getEmergencyCaseById(
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
          "Authenticated hospital context is required.",
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

    const emergencyCase =
      await emergencyService.getEmergencyCaseById(
        emergencyCaseId,
        hospitalId,
      );

    if (!emergencyCase) {
      return res.status(404).json({
        success: false,
        message:
          "Emergency case not found.",
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

/**
 * Assign an emergency case to a bed.
 *
 * Body:
 *
 * {
 *   "bedId": 123,
 *   "locationType": "EMERGENCY",
 *   "notes": "Resuscitation area"
 * }
 */
async function assignEmergencyLocation(
  req,
  res,
  next,
) {
  try {
    const hospitalId =
      getAuthenticatedHospitalId(req);

    const assignedBy =
      getAuthenticatedUserId(req);

    if (!hospitalId || !assignedBy) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated user context is required.",
      });
    }

    const emergencyCaseId =
      parsePositiveInteger(
        req.params.emergencyCaseId,
      );

    const bedId =
      parsePositiveInteger(
        req.body.bedId,
      );

    const locationType =
      String(
        req.body.locationType || "",
      )
        .trim()
        .toUpperCase();

    if (!emergencyCaseId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid emergencyCaseId is required.",
      });
    }

    if (!bedId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid bedId is required.",
      });
    }

    if (!locationType) {
      return res.status(400).json({
        success: false,
        message:
          "locationType is required.",
      });
    }

    const result =
      await emergencyService.assignEmergencyLocation({
        emergencyCaseId,
        hospitalId,
        bedId,
        locationType,
        assignedBy,
        notes:
          req.body.notes || null,
      });

    return res.status(201).json({
      success: true,
      message:
        "Emergency location assigned successfully.",
      data: result,
    });
  } catch (error) {
    if (
      error?.code === "23505"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "The selected bed or emergency case already has an active location.",
      });
    }

    return sendServiceError(
      res,
      error,
    );
  }
}

/**
 * Transfer an emergency case:
 *
 * EMERGENCY -> ICU
 * EMERGENCY -> WARD
 * ICU -> WARD
 * WARD -> ICU
 *
 * Body:
 *
 * {
 *   "targetBedId": 123,
 *   "targetLocationType": "ICU",
 *   "notes": "Transferred for critical care"
 * }
 */
async function transferEmergencyLocation(
  req,
  res,
  next,
) {
  try {
    const hospitalId =
      getAuthenticatedHospitalId(req);

    const assignedBy =
      getAuthenticatedUserId(req);

    if (!hospitalId || !assignedBy) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated user context is required.",
      });
    }

    const emergencyCaseId =
      parsePositiveInteger(
        req.params.emergencyCaseId,
      );

    const targetBedId =
      parsePositiveInteger(
        req.body.targetBedId,
      );

    const targetLocationType =
      String(
        req.body.targetLocationType ||
          "",
      )
        .trim()
        .toUpperCase();

    if (!emergencyCaseId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid emergencyCaseId is required.",
      });
    }

    if (!targetBedId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid targetBedId is required.",
      });
    }

    if (!targetLocationType) {
      return res.status(400).json({
        success: false,
        message:
          "targetLocationType is required.",
      });
    }

    const result =
      await emergencyService.transferEmergencyLocation({
        emergencyCaseId,
        hospitalId,
        targetBedId,
        targetLocationType,
        assignedBy,
        notes:
          req.body.notes || null,
      });

    return res.status(200).json({
      success: true,
      message:
        "Emergency case transferred successfully.",
      data: result,
    });
  } catch (error) {
    if (
      error?.code === "23505"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "The target bed is already assigned.",
      });
    }

    return sendServiceError(
      res,
      error,
    );
  }
}

/**
 * Discharge an emergency case.
 */
async function dischargeEmergencyCase(
  req,
  res,
  next,
) {
  try {
    const hospitalId =
      getAuthenticatedHospitalId(req);

    const dischargedBy =
      getAuthenticatedUserId(req);

    if (!hospitalId || !dischargedBy) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated user context is required.",
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

    const result =
      await emergencyService.dischargeEmergencyCase({
        emergencyCaseId,
        hospitalId,
        dischargedBy,
        notes:
          req.body.notes || null,
      });

    return res.status(200).json({
      success: true,
      message:
        "Emergency case discharged successfully.",
      data: result,
    });
  } catch (error) {
    return sendServiceError(
      res,
      error,
    );
  }
}

/**
 * Get the current active location.
 */
async function getEmergencyCaseLocation(
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
          "Authenticated hospital context is required.",
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

    const location =
      await emergencyService.getEmergencyCaseLocation(
        emergencyCaseId,
        hospitalId,
      );

    return res.status(200).json({
      success: true,
      data: location,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get complete location history.
 */
async function getEmergencyCaseLocationHistory(
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
          "Authenticated hospital context is required.",
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

    const history =
      await emergencyService.getEmergencyCaseLocationHistory(
        emergencyCaseId,
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
  createEmergencyCase,
  getEmergencyCases,
  getEmergencyCaseById,
  assignEmergencyLocation,
  transferEmergencyLocation,
  dischargeEmergencyCase,
  getEmergencyCaseLocation,
  getEmergencyCaseLocationHistory,
};