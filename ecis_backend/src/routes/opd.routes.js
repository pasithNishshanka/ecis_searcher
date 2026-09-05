const express = require('express');

const {
  createOpdVisit,
  getPatientOpdHistory,
} = require('../controllers/opd.controller');

const router = express.Router();

router.post('/visits', createOpdVisit);

router.get(
  '/patients/:patientId/history',
  getPatientOpdHistory
);

module.exports = router;