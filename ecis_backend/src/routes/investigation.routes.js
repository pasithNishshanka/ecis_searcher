const express = require('express');

const {
  createInvestigation,
  getPatientInvestigations,
  getInvestigationById,
} = require(
  '../controllers/investigation.controller'
);

const router = express.Router();

router.post('/', createInvestigation);

router.get(
  '/patient/:patientId',
  getPatientInvestigations
);

router.get(
  '/:investigationId',
  getInvestigationById
);

module.exports = router;