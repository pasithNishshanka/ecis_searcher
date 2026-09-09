const patientService = require("../services/patient.service");

/* ============================================================
   CREATE
   ============================================================ */

async function createPatient(req, res, next) {
  try {
    const hospitalId = req.user?.hospitalId;

    if (!hospitalId) {
      return res.status(401).json({
        success: false,

        message: "Authenticated hospital information is missing.",
      });
    }

    if (!req.body?.firstName || !String(req.body.firstName).trim()) {
      return res.status(400).json({
        success: false,

        message: "First name is required.",
      });
    }

    if (!req.body?.dateOfBirth) {
      return res.status(400).json({
        success: false,

        message: "Date of birth is required.",
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
    console.error("CREATE PATIENT:", error);

    next(error);
  }
}

/* ============================================================
   GET ALL
   ============================================================ */

async function getAllPatients(req, res, next) {
  try {
    const patients = await patientService.getAllPatients(req.user.hospitalId);

    return res.status(200).json({
      success: true,

      count: patients.length,

      data: patients,
    });
  } catch (error) {
    console.error("GET PATIENTS:", error);

    next(error);
  }
}

/* ============================================================
   GET BY ID
   ============================================================ */

async function getPatientById(req, res, next) {
  try {
    const patient = await patientService.getPatientById(req.params.patientId);

    if (!patient) {
      return res.status(404).json({
        success: false,

        message: "Patient not found.",
      });
    }

    if (Number(patient.hospital_id) !== Number(req.user.hospitalId)) {
      return res.status(403).json({
        success: false,

        message: "Patient does not belong to your hospital.",
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

/* ============================================================
   SEARCH
   ============================================================ */

async function searchPatients(req, res, next) {
  try {
    const searchTerm = String(req.query.q || "").trim();

    if (!searchTerm) {
      return res.status(400).json({
        success: false,

        message: "Search query is required.",
      });
    }

    const patients = await patientService.searchPatients(
      req.user.hospitalId,

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

/* ============================================================
   UPDATE
   ============================================================ */

async function updatePatient(req, res, next) {
  try {
    const patient = await patientService.getPatientById(req.params.patientId);

    if (!patient) {
      return res.status(404).json({
        success: false,

        message: "Patient not found.",
      });
    }

    if (Number(patient.hospital_id) !== Number(req.user.hospitalId)) {
      return res.status(403).json({
        success: false,

        message: "Patient does not belong to your hospital.",
      });
    }

    const updated = await patientService.updatePatient(
      req.params.patientId,

      req.body,
    );

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
