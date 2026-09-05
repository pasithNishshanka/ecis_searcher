const wardService = require("../services/ward.service");

async function createWard(req, res, next) {
  try {
    const { hospitalId, wardCode, wardName } = req.body;

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "hospitalId is required",
      });
    }

    if (!wardCode || !wardCode.trim()) {
      return res.status(400).json({
        success: false,
        message: "wardCode is required",
      });
    }

    if (!wardName || !wardName.trim()) {
      return res.status(400).json({
        success: false,
        message: "wardName is required",
      });
    }

    const ward = await wardService.createWard(req.body);

    return res.status(201).json({
      success: true,
      message: "Ward created successfully",
      data: ward,
    });
  } catch (error) {
    next(error);
  }
}

async function getWardsByHospital(req, res, next) {
  try {
    const { hospitalId } = req.params;

    const wards = await wardService.getWardsByHospital(hospitalId);

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
    const { wardId } = req.params;
    const { bedNumber } = req.body;

    if (!bedNumber || !bedNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: "bedNumber is required",
      });
    }

    const bed = await wardService.createBed(wardId, req.body);

    return res.status(201).json({
      success: true,
      message: "Bed created successfully",
      data: bed,
    });
  } catch (error) {
    next(error);
  }
}

async function getBedsByWard(req, res, next) {
  try {
    const { wardId } = req.params;

    const beds = await wardService.getBedsByWard(wardId);

    return res.status(200).json({
      success: true,
      count: beds.length,
      data: beds,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createWard,
  getWardsByHospital,
  createBed,
  getBedsByWard,
};
