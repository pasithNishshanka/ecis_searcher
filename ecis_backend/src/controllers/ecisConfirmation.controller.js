const ecisConfirmationService =
  require(
    "../services/ecisConfirmation.service",
  );


function positiveInteger(
  value,
) {
  const number =
    Number(value);

  return Number.isInteger(
    number,
  ) && number > 0
    ? number
    : null;
}


async function confirmIdentity(
  req,
  res,
  next,
) {
  try {
    const emergencyCaseId =
      positiveInteger(
        req.body?.emergencyCaseId,
      );

    const patientId =
      positiveInteger(
        req.body?.patientId,
      );

    const hospitalId =
      positiveInteger(
        req.user?.hospitalId,
      );

    const reviewerUserId =
      positiveInteger(
        req.user?.userId,
      );

    if (!emergencyCaseId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid emergencyCaseId is required",
      });
    }

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid patientId is required",
      });
    }

    if (!hospitalId) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated hospital information is missing",
      });
    }

    if (!reviewerUserId) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated reviewer information is missing",
      });
    }

    const result =
      await ecisConfirmationService.confirmIdentity(
        {
          ...req.body,

          emergencyCaseId,

          patientId,

          hospitalId,

          reviewerUserId,
        },
      );

    return res.status(200).json({
      success: true,

      message:
        "Emergency case identity confirmed and linked to the existing patient",

      data:
        result,
    });
  } catch (
    error
  ) {
    const message =
      error?.message ||
      "Unable to confirm emergency identity";

    if (
      message.includes(
        "required",
      ) ||
      message.includes(
        "must be",
      ) ||
      message.includes(
        "requires a previous",
      )
    ) {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    if (
      message.includes(
        "not authorized",
      ) ||
      message.includes(
        "not found",
      ) ||
      message.includes(
        "already linked",
      )
    ) {
      return res.status(403).json({
        success: false,
        message,
      });
    }

    next(error);
  }
}


module.exports = {
  confirmIdentity,
};