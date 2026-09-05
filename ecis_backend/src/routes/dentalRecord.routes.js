const express = require('express');

const {
  createDentalRecord,
  getPatientDentalRecords,
  getDentalRecordById,
} = require(
  '../controllers/dentalRecord.controller'
);

const router = express.Router();

router.post('/', createDentalRecord);

router.get(
  '/patient/:patientId',
  getPatientDentalRecords
);

router.get(
  '/:dentalRecordId',
  getDentalRecordById
);

module.exports = router;