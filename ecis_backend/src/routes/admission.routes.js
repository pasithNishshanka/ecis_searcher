const express = require('express');

const {
  createAdmission,
  getPatientAdmissions,
  getAdmissionById,
} = require('../controllers/admission.controller');

const router = express.Router();

router.post('/', createAdmission);

router.get(
  '/patient/:patientId',
  getPatientAdmissions
);

router.get(
  '/:admissionId',
  getAdmissionById
);

module.exports = router;