const express = require('express');

const {
  createPatient,
  getAllPatients,
  getPatientByNumber,
  updatePatient,
  searchPatients,
  getPatientHistory,
} = require('../controllers/patient.controller');

const router = express.Router();

// Create patient
router.post('/', createPatient);

// Get all patients
router.get('/', getAllPatients);

// Search patients
// IMPORTANT: keep this before /:patientNumber
router.get('/search', searchPatients);

// Get patient history
router.get('/:patientNumber/history', getPatientHistory);

// Get one patient
router.get('/:patientNumber', getPatientByNumber);

// Update patient
router.put('/:patientNumber', updatePatient);

module.exports = router;