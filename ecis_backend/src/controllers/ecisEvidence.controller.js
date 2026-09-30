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
    const accessedBy = Number(req.user?.userId);

    const emergencyCaseId = req.query.emergencyCaseId == null
      ? null
      : Number(req.query.emergencyCaseId);

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

    if (!Number.isInteger(accessedBy) || accessedBy <= 0) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user is required",
      });
    }

    if (emergencyCaseId !== null &&
        (!Number.isInteger(emergencyCaseId) || emergencyCaseId <= 0)) {
      return res.status(400).json({
        success: false,
        message: "Invalid emergencyCaseId",
      });
    }

    const evidence =
      await ecisEvidenceService.getCandidateEvidence(
        patientId,
        hospitalId,
        emergencyCaseId,
        accessedBy,
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
