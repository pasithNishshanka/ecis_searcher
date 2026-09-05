const dentalService = require(
  '../services/dentalRecord.service'
);


async function createDentalRecord(req, res, next) {
  try {
    const {
      patientId,
      toothNumber,
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'patientId is required',
      });
    }

    if (!toothNumber || !toothNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: 'toothNumber is required',
      });
    }

    const dentalRecord =
      await dentalService.createDentalRecord(
        req.body
      );

    return res.status(201).json({
      success: true,
      message: 'Dental record created successfully',
      data: dentalRecord,
    });

  } catch (error) {
    next(error);
  }
}


async function getPatientDentalRecords(req, res, next) {
  try {
    const { patientId } = req.params;

    const records =
      await dentalService.getPatientDentalRecords(
        patientId
      );

    return res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });

  } catch (error) {
    next(error);
  }
}


async function getDentalRecordById(req, res, next) {
  try {
    const { dentalRecordId } = req.params;

    const record =
      await dentalService.getDentalRecordById(
        dentalRecordId
      );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Dental record not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: record,
    });

  } catch (error) {
    next(error);
  }
}


module.exports = {
  createDentalRecord,
  getPatientDentalRecords,
  getDentalRecordById,
};