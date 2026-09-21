const patientService = require("../services/patient.service");

function getHospitalId(req) {
  const hospitalId = Number(req.user?.hospitalId);

  return Number.isInteger(hospitalId) && hospitalId > 0 ? hospitalId : null;
}

async function createPatient(req, res, next) {
  try {
    const hospitalId = getHospitalId(req);

    if (!hospitalId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated hospital information is missing.",
      });
    }

    const patient = await patientService.createPatient({
      ...req.body,
      hospitalId,
    });

    return res.status(201).json({
      success: true,
      message: "Patient registered successfully.",
      data: patient,
    });
  } catch (error) {
    next(error);
  }
}

async function getAllPatients(req, res, next) {
  try {
    const hospitalId = getHospitalId(req);

    if (!hospitalId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated hospital information is missing.",
      });
    }

    const patients = await patientService.getAllPatients(hospitalId);

    return res.status(200).json({
      success: true,
      count: patients.length,
      data: patients,
    });
  } catch (error) {
    next(error);
  }
}

async function getPatientById(req, res, next) {
  try {
    const hospitalId = getHospitalId(req);

    const patientId = Number(req.params.patientId);

    if (!hospitalId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated hospital information is missing.",
      });
    }

    if (!Number.isInteger(patientId) || patientId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid patient ID.",
      });
    }

    const patient = await patientService.getPatientById(patientId, hospitalId);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: patient,
    });
  } catch (error) {
    next(error);
  }
}

async function searchPatients(req, res, next) {
  try {
    const hospitalId = getHospitalId(req);

    const searchTerm = String(req.query.q || "").trim();

    if (!hospitalId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated hospital information is missing.",
      });
    }

    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: "Search query is required.",
      });
    }

    const patients = await patientService.searchPatients(
      hospitalId,
      searchTerm,
    );

    return res.status(200).json({
      success: true,
      count: patients.length,
      data: patients,
    });
  } catch (error) {
    next(error);
  }
}

async function updatePatient(req, res, next) {
  try {
    const hospitalId = getHospitalId(req);

    const patientId = Number(req.params.patientId);

    if (!hospitalId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated hospital information is missing.",
      });
    }

    if (!Number.isInteger(patientId) || patientId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid patient ID.",
      });
    }

    const updated = await patientService.updatePatient(
      patientId,
      hospitalId,
      req.body || {},
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Patient not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Patient updated successfully.",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createPatient,
  getAllPatients,
  getPatientById,
  searchPatients,
  updatePatient,
};
