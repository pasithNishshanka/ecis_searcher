const express = require('express');

const {
  createProcedure,
  getPatientProcedures,
} = require('../controllers/procedure.controller');

const router = express.Router();

router.post('/', createProcedure);

router.get(
  '/patient/:patientId',
  getPatientProcedures
);

module.exports = router;