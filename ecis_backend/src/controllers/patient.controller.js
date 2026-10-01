const patientService = require("../services/patient.service");
const medicalRecordService = require("../services/medicalRecord.service");
const pool = require("../config/database");

function classifyRegistrationError(error) {
  if (error.code === "23505") {
    error.statusCode = 409;
    error.expose = true;
    error.message = "A patient with this identifier already exists. Find the existing patient instead of registering a duplicate.";
    return;
  }

  if (error.message === "A patient with this NIC already exists.") {
    error.statusCode = 409;
    error.expose = true;
    error.message = "A patient with this NIC already exists. Use Find existing patient to register them at this hospital.";
    return;
  }

  if (error.message === "Hospital not found.") {
    error.statusCode = 404;
    error.expose = true;
    return;
  }

  const validationMessages = [
    "Hospital context is required.",
    "First name and last name are required.",
    "Date of birth is required.",
    "Invalid date of birth.",
    "Date of birth cannot be in the future.",
    "Only patients aged between 18 and 120 years can be registered.",
    "Gender is required.",
    "Province is required.",
    "District is required.",
    "District does not belong to the selected province.",
    "Allergy status is required.",
    "Invalid allergy status.",
    "At least one food or medical / drug allergy is required when allergy status is Has allergies.",
    "Remove allergy entries or change the allergy status before saving.",
  ];
  if (validationMessages.includes(error.message) || /^(Height|Weight) must be a valid number between /.test(error.message)) {
    error.statusCode = 400;
    error.expose = true;
  }
}

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
    classifyRegistrationError(error);
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
    const gender = String(req.query.gender || "").trim();
    const page = req.query.page === undefined ? 1 : Number(req.query.page);

    if (!hospitalId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated hospital information is missing.",
      });
    }

    if (gender && !["Male", "Female", "Other"].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: "Invalid gender filter.",
      });
    }

    if (!searchTerm && !gender) {
      return res.status(400).json({
        success: false,
        message: "A search query or gender filter is required.",
      });
    }

    if (!Number.isSafeInteger(page) || page < 1) {
      return res.status(400).json({ success: false, message: "Page must be a positive integer." });
    }

    const result = await patientService.searchPatients(
      hospitalId,
      searchTerm,
      gender || null,
      page,
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.page * result.pageSize < result.total,
      data: result.rows,
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
