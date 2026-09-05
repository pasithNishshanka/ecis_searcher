const express = require('express');

const {
  createMedicalDevice,
  getPatientMedicalDevices,
  getMedicalDeviceById,
} = require(
  '../controllers/medicalDevice.controller'
);

const router = express.Router();

router.post('/', createMedicalDevice);

router.get(
  '/patient/:patientId',
  getPatientMedicalDevices
);

router.get(
  '/:deviceId',
  getMedicalDeviceById
);

module.exports = router;