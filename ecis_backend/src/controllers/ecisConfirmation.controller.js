const ecisConfirmationService = require("../services/ecisConfirmation.service");

const confirmIdentity = async (req, res) => {
  try {
    const { emergencyCaseId, patientId, reviewedBy, reviewReason } = req.body;

    if (!reviewReason || !reviewReason.trim()) {
      return res.status(400).json({
        success: false,
        message: "reviewReason is required",
      });
    }

    const result = await ecisConfirmationService.confirmIdentity({
      emergencyCaseId,
      patientId,
      reviewedBy,
      reviewReason,
    });

    return res.status(200).json({
      success: true,
      message: "Emergency patient identity confirmed successfully",
      data: result,
    });
  } catch (error) {
    console.error("ECIS identity confirmation error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  confirmIdentity,
};
