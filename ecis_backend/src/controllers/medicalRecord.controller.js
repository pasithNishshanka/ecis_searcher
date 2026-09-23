const medicalRecordService =
  require(
    "../services/medicalRecord.service",
  );


function positiveInteger(
  value,
) {
  const number =
    Number(value);

  return (
    Number.isInteger(
      number,
    ) &&
    number > 0
  )
    ? number
    : null;
}


/* ============================================================
   GET PATIENT LONGITUDINAL MEDICAL RECORD
   ============================================================ */

async function getPatientMedicalRecord(
  req,
  res,
  next,
) {
  try {
    const patientId =
      positiveInteger(
        req.params.patientId,
      );

    const hospitalId =
      positiveInteger(
        req.user?.hospitalId,
      );


    if (!patientId) {
      return res.status(400).json({
        success: false,

        message:
          "A valid patientId is required.",
      });
    }


    if (!hospitalId) {
      return res.status(401).json({
        success: false,

        message:
          "Authenticated hospital information is missing.",
      });
    }


    const record =
      await medicalRecordService.getMedicalRecord(
        patientId,
        hospitalId,
      );


    return res.status(200).json({
      success: true,

      data: record,
    });
  } catch (error) {
    const message =
      error?.message || "";


    if (
      message.includes(
        "not found",
      ) ||
      message.includes(
        "not active",
      )
    ) {
      return res.status(404).json({
        success: false,

        message,
      });
    }


    if (
      message.includes(
        "must be a positive integer",
      )
    ) {
      return res.status(400).json({
        success: false,

        message,
      });
    }


    next(error);
  }
}


module.exports = {
  getPatientMedicalRecord,
};