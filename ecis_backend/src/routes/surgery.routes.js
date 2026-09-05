const express = require('express');

const {
  createSurgery,
  getPatientSurgeries,
  getSurgeryById,
} = require('../controllers/surgery.controller');

const router = express.Router();

router.post('/', createSurgery);

router.get(
  '/patient/:patientId',
  getPatientSurgeries
);

router.get(
  '/:surgeryId',
  getSurgeryById
);

module.exports = router;