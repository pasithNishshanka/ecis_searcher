const patientService = require("../services/patient.service");


async function createPatient(req, res, next) {
  try {
    const { hospitalId, patientNumber, firstName, heightCm, weightKg } =
      req.body;

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "hospitalId is required",
      });
    }

    if (!patientNumber || !patientNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: "patientNumber is required",
      });
    }

    if (!firstName || !firstName.trim()) {
      return res.status(400).json({
        success: false,
        message: "firstName is required",
      });
    }

    if (heightCm !== undefined && heightCm !== null) {
      if (Number.isNaN(Number(heightCm)) || Number(heightCm) <= 0) {
        return res.status(400).json({
          success: false,
          message: "heightCm must be a positive number",
        });
      }
    }

    if (weightKg !== undefined && weightKg !== null) {
      if (Number.isNaN(Number(weightKg)) || Number(weightKg) <= 0) {
        return res.status(400).json({
          success: false,
          message: "weightKg must be a positive number",
        });
      }
    }

    const patient = await patientService.createPatient(req.body);

    return res.status(201).json({
      success: true,
      message: "Patient registered successfully",
      data: patient,
    });
  } catch (error) {
    next(error);
  }
}

async function getAllPatients(req, res, next) {
  try {
    const patients = await patientService.getAllPatients();

    return res.status(200).json({
      success: true,
      count: patients.length,
      data: patients,
    });
  } catch (error) {
    next(error);
  }
}

async function getPatientByNumber(req, res, next) {
  try {
    const { patientNumber } = req.params;

    const patient = await patientService.getPatientByNumber(patientNumber);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
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

async function updatePatient(req, res, next) {
  try {
    const { patientNumber } = req.params;

    const patient = await patientService.updatePatient(patientNumber, req.body);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Patient updated successfully",
      data: patient,
    });
  } catch (error) {
    next(error);
  }
}

async function searchPatients(req, res, next) {
  try {
    const { q } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const patients = await patientService.searchPatients(q.trim());

    return res.status(200).json({
      success: true,
      count: patients.length,
      data: patients,
    });
  } catch (error) {
    next(error);
  }
}


async function getPatientHistory(req, res, next) {
  try {
    const { patientNumber } = req.params;

    const patient = await patientService.getPatientHistory(
      patientNumber
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        patient,
      },
    });
  } catch (error) {
    next(error);
  }
}


module.exports = {
  createPatient,
  getAllPatients,
  getPatientByNumber,
  updatePatient,
  searchPatients,
  getPatientHistory,
};

