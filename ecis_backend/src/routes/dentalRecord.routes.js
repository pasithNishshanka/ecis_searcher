const express = require('express');

const {
  createDentalRecord,
  getPatientDentalRecords,
  getDentalRecordById,
} = require(
  '../controllers/dentalRecord.controller'
);

const {
  authorizeRoles,
} = require(
  '../middleware/authorization.middleware'
);

const router = express.Router();

/* Only a clinical user can record a dental consultation. */
router.post(
  '/',
  authorizeRoles('DOCTOR'),
  createDentalRecord,
);

router.get(
  '/patient/:patientId',
  getPatientDentalRecords
);

router.get(
  '/:dentalRecordId',
  getDentalRecordById
);

module.exports = router;
