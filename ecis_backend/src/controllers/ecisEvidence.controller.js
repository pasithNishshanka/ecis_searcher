const ecisEvidenceService =
  require("../services/ecisEvidence.service");

async function getCandidateEvidence(
  req,
  res,
  next,
) {
  try {
    const patientId =
      Number(req.params.patientId);

    const hospitalId =
      Number(req.user?.hospitalId);

    if (
      !Number.isInteger(patientId) ||
      patientId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid patientId",
      });
    }

    if (
      !Number.isInteger(hospitalId) ||
      hospitalId <= 0
    ) {
      return res.status(401).json({
        success: false,
        message: "Authenticated hospital is required",
      });
    }

    const evidence =
      await ecisEvidenceService.getCandidateEvidence(
        patientId,
        hospitalId,
      );

    return res.status(200).json({
      success: true,
      data: evidence,
    });
  } catch (error) {
    if (
      error.message?.includes(
        "Adult patient was not found",
      )
    ) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
}

module.exports = {
  getCandidateEvidence,
};