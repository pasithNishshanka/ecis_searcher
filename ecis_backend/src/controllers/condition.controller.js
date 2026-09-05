const conditionService = require(
  '../services/condition.service'
);


async function createCondition(req, res, next) {
  try {
    const {
      conditionName,
    } = req.body;

    if (
      !conditionName ||
      !conditionName.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'conditionName is required',
      });
    }

    const condition =
      await conditionService.createCondition(
        req.body
      );

    return res.status(201).json({
      success: true,
      message: 'Medical condition created successfully',
      data: condition,
    });

  } catch (error) {
    next(error);
  }
}


async function getAllConditions(req, res, next) {
  try {
    const conditions =
      await conditionService.getAllConditions();

    return res.status(200).json({
      success: true,
      count: conditions.length,
      data: conditions,
    });

  } catch (error) {
    next(error);
  }
}


async function addPatientCondition(req, res, next) {
  try {
    const {
      patientId,
      conditionId,
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'patientId is required',
      });
    }

    if (!conditionId) {
      return res.status(400).json({
        success: false,
        message: 'conditionId is required',
      });
    }

    const patientCondition =
      await conditionService.addPatientCondition(
        req.body
      );

    return res.status(201).json({
      success: true,
      message: 'Patient diagnosis added successfully',
      data: patientCondition,
    });

  } catch (error) {
    next(error);
  }
}


async function getPatientConditions(req, res, next) {
  try {
    const { patientId } = req.params;

    const conditions =
      await conditionService.getPatientConditions(
        patientId
      );

    return res.status(200).json({
      success: true,
      count: conditions.length,
      data: conditions,
    });

  } catch (error) {
    next(error);
  }
}


async function getPatientConditionById(req, res, next) {
  try {
    const {
      patientConditionId,
    } = req.params;

    const condition =
      await conditionService.getPatientConditionById(
        patientConditionId
      );

    if (!condition) {
      return res.status(404).json({
        success: false,
        message: 'Patient diagnosis not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: condition,
    });

  } catch (error) {
    next(error);
  }
}


module.exports = {
  createCondition,
  getAllConditions,
  addPatientCondition,
  getPatientConditions,
  getPatientConditionById,
};