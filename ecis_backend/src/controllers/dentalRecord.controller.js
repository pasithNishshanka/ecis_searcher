const dentalService = require(
  '../services/dentalRecord.service'
);

function getHospitalId(req) {
  const hospitalId = Number(req.user?.hospitalId);

  return Number.isInteger(hospitalId) && hospitalId > 0
    ? hospitalId
    : null;
}

function getUserId(req) {
  const userId = Number(req.user?.userId);

  return Number.isInteger(userId) && userId > 0
    ? userId
    : null;
}

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

    const hospitalId = getHospitalId(req);
    const recordedBy = getUserId(req);

    if (!hospitalId || !recordedBy) {
      return res.status(401).json({
        success: false,
        message: 'Authenticated hospital clinician is required.',
      });
    }

    const dentalRecord =
      await dentalService.createDentalRecord(
        {
          ...req.body,
          patientId: Number(patientId),
          hospitalId,
          /* The signed-in clinician is authoritative. */
          recordedBy,
        },
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
    const hospitalId = getHospitalId(req);

    if (!hospitalId) {
      return res.status(401).json({
        success: false,
        message: 'Authenticated hospital information is missing.',
      });
    }

    const records =
      await dentalService.getPatientDentalRecords(
        patientId,
        hospitalId,
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
    const hospitalId = getHospitalId(req);

    if (!hospitalId) {
      return res.status(401).json({
        success: false,
        message: 'Authenticated hospital information is missing.',
      });
    }

    const record =
      await dentalService.getDentalRecordById(
        dentalRecordId,
        hospitalId,
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
