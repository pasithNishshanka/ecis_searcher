const clinicService = require("../services/clinic.service");

async function createClinic(req, res, next) {
  try {
    const { hospitalId, clinicCode, clinicName } = req.body;

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "hospitalId is required",
      });
    }

    if (!clinicCode || !clinicCode.trim()) {
      return res.status(400).json({
        success: false,
        message: "clinicCode is required",
      });
    }

    if (!clinicName || !clinicName.trim()) {
      return res.status(400).json({
        success: false,
        message: "clinicName is required",
      });
    }

    const clinic = await clinicService.createClinic(req.body);

    return res.status(201).json({
      success: true,
      message: "Clinic created successfully",
      data: clinic,
    });
  } catch (error) {
    next(error);
  }
}

async function getClinicsByHospital(req, res, next) {
  try {
    const { hospitalId } = req.params;

    const clinics = await clinicService.getClinicsByHospital(hospitalId);

    return res.status(200).json({
      success: true,
      count: clinics.length,
      data: clinics,
    });
  } catch (error) {
    next(error);
  }
}

async function createClinicVisit(req, res, next) {
  try {
    const { clinicId, patientId, hospitalId } = req.body;

    if (!clinicId) {
      return res.status(400).json({
        success: false,
        message: "clinicId is required",
      });
    }

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

    const result = await clinicService.createClinicVisit(req.body);

    return res.status(201).json({
      success: true,
      message: "Clinic visit created successfully",
      data: result,
    });
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
}

async function getPatientClinicHistory(req, res, next) {
  try {
    const { patientId } = req.params;

    const history = await clinicService.getPatientClinicHistory(patientId);

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
  createClinic,
  getClinicsByHospital,
  createClinicVisit,
  getPatientClinicHistory,
};
