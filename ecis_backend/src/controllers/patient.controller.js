const patientService = require("../services/patient.service");
const medicalRecordService = require("../services/medicalRecord.service");
const pool = require("../config/database");

function getHospitalId(req) {
  const hospitalId = Number(req.user?.hospitalId);

  return Number.isInteger(hospitalId) && hospitalId > 0 ? hospitalId : null;
}

function getUserId(req) {
  const userId = Number(req.user?.userId);

  return Number.isInteger(userId) && userId > 0 ? userId : null;
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
      registeredBy: getUserId(req),
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

async function registerPatientAtCurrentHospital(req, res, next) {
  try {
    const hospitalId = getHospitalId(req);
    const userId = getUserId(req);
    const patientId = Number(req.params.patientId);

    if (!hospitalId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated hospital user information is missing.",
      });
    }

    if (!Number.isInteger(patientId) || patientId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid patient ID.",
      });
    }

    const patient = await patientService.registerPatientAtHospital(
      patientId,
      hospitalId,
      userId,
    );

    return res.status(200).json({
      success: true,
      message: "Patient is registered for the authenticated hospital.",
      data: patient,
    });
  } catch (error) {
    next(error);
  }
}

async function searchCentralPatients(req, res, next) {
  try {
    const searchTerm = String(req.query.q || "").trim();
    const patients = await patientService.searchCentralPatients(searchTerm);

    return res.status(200).json({
      success: true,
      count: patients.length,
      data: patients,
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

async function getPatientClinicalContext(req, res, next) {
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

    const context = await medicalRecordService.getMedicalRecord(
      patientId,
      hospitalId,
    );

    await pool.query(
      `INSERT INTO public.audit_logs (
         hospital_id, user_id, action_type, entity_type, entity_id
       ) VALUES ($1, $2, 'PATIENT_360_ACCESSED', 'patient', $3);`,
      [hospitalId, getUserId(req), patientId],
    );

    return res.status(200).json({
      success: true,
      data: context,
    });
  } catch (error) {
    if (String(error.message || "").includes("patient was not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

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
  getPatientClinicalContext,
  searchPatients,
  updatePatient,
  registerPatientAtCurrentHospital,
  searchCentralPatients,
};
