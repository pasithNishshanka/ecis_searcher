const procedureService = require('../services/procedure.service');


async function createProcedure(req, res, next) {
  try {
    const {
      patientId,
      encounterId,
      procedureName,
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'patientId is required',
      });
    }

    if (!encounterId) {
      return res.status(400).json({
        success: false,
        message: 'encounterId is required',
      });
    }

    if (!procedureName || !procedureName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'procedureName is required',
      });
    }

    const procedure =
      await procedureService.createProcedure(req.body);

    return res.status(201).json({
      success: true,
      message: 'Procedure created successfully',
      data: procedure,
    });
  } catch (error) {
    next(error);
  }
}


async function getPatientProcedures(req, res, next) {
  try {
    const { patientId } = req.params;

    const procedures =
      await procedureService.getPatientProcedures(patientId);

    return res.status(200).json({
      success: true,
      count: procedures.length,
      data: procedures,
    });
  } catch (error) {
    next(error);
  }
}


module.exports = {
  createProcedure,
  getPatientProcedures,
};