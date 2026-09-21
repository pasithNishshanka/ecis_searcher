const wardService = require("../services/ward.service");

function getAuthenticatedHospitalId(req) {
  const hospitalId = Number(req.user?.hospitalId);

  if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
    return null;
  }

  return hospitalId;
}

function parsePositiveInteger(value) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function createWard(req, res, next) {
  try {
    const hospitalId = getAuthenticatedHospitalId(req);

    if (!hospitalId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated hospital information is missing.",
      });
    }

    const {
      wardCode,
      wardName,
      wardType,
      floor,
      location,
      capacity,
      genderPolicy,
    } = req.body;

    if (!wardCode || !String(wardCode).trim()) {
      return res.status(400).json({
        success: false,
        message: "wardCode is required.",
      });
    }

    if (!wardName || !String(wardName).trim()) {
      return res.status(400).json({
        success: false,
        message: "wardName is required.",
      });
    }

    const parsedCapacity = parsePositiveInteger(capacity);

    if (!parsedCapacity) {
      return res.status(400).json({
        success: false,
        message: "capacity must be a positive integer.",
      });
    }

    const ward = await wardService.createWard({
      hospitalId,
      wardCode: String(wardCode).trim(),
      wardName: String(wardName).trim(),
      wardType: wardType ? String(wardType).trim() : null,
      floor: floor != null ? String(floor).trim() : null,
      location: location ? String(location).trim() : null,
      capacity: parsedCapacity,
      genderPolicy: genderPolicy
        ? String(genderPolicy).trim()
        : null,
    });

    return res.status(201).json({
      success: true,
      message: "Ward created successfully.",
      data: ward,
    });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({
        success: false,
        message:
          "A ward with the same code already exists for this hospital.",
      });
    }

    next(error);
  }
}

async function getWardsByHospital(req, res, next) {
  try {
    const authenticatedHospitalId = getAuthenticatedHospitalId(req);

    if (!authenticatedHospitalId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated hospital information is missing.",
      });
    }

    /*
     * The hospital ID in the URL is intentionally ignored.
     *
     * The authenticated user's hospital is always used.
     * This prevents one hospital from requesting another
     * hospital's ward data.
     */
    const wards = await wardService.getWardsByHospital(
      authenticatedHospitalId,
    );

    return res.status(200).json({
      success: true,
      count: wards.length,
      data: wards,
    });
  } catch (error) {
    next(error);
  }
}

async function createBed(req, res, next) {
  try {
    const authenticatedHospitalId = getAuthenticatedHospitalId(req);

    if (!authenticatedHospitalId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated hospital information is missing.",
      });
    }

    const wardId = parsePositiveInteger(req.params.wardId);

    if (!wardId) {
      return res.status(400).json({
        success: false,
        message: "A valid wardId is required.",
      });
    }

    const { bedNumber, bedType } = req.body;

    if (!bedNumber || !String(bedNumber).trim()) {
      return res.status(400).json({
        success: false,
        message: "bedNumber is required.",
      });
    }

    const bed = await wardService.createBed(
      authenticatedHospitalId,
      wardId,
      {
        bedNumber: String(bedNumber).trim(),
        bedType: bedType ? String(bedType).trim() : null,
      },
    );

    return res.status(201).json({
      success: true,
      message: "Bed created successfully.",
      data: bed,
    });
  } catch (error) {
    if (
      error?.message === "Ward not found or inactive." ||
      error?.message ===
        "Ward capacity has already been reached."
    ) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    if (error?.code === "23505") {
      return res.status(409).json({
        success: false,
        message:
          "A bed with the same number already exists in this ward.",
      });
    }

    next(error);
  }
}

async function getBedsByWard(req, res, next) {
  try {
    const authenticatedHospitalId = getAuthenticatedHospitalId(req);

    if (!authenticatedHospitalId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated hospital information is missing.",
      });
    }

    const wardId = parsePositiveInteger(req.params.wardId);

    if (!wardId) {
      return res.status(400).json({
        success: false,
        message: "A valid wardId is required.",
      });
    }

    const beds = await wardService.getBedsByWard(
      authenticatedHospitalId,
      wardId,
    );

    return res.status(200).json({
      success: true,
      count: beds.length,
      data: beds,
    });
  } catch (error) {
    if (error?.message === "Ward not found or inactive.") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
}

module.exports = {
  createWard,
  getWardsByHospital,
  createBed,
  getBedsByWard,
};