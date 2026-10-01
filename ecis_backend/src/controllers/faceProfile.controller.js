const faceProfiles = require("../services/faceProfile.service");

function context(req) {
  const patientId = Number(req.params.patientId);
  const hospitalId = Number(req.user?.hospitalId);
  const userId = Number(req.user?.userId);
  if (![patientId, hospitalId, userId].every((value) => Number.isSafeInteger(value) && value > 0)) {
    const error = new Error("Valid patient and authenticated hospital user are required.");
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }
  return { patientId, hospitalId, userId };
}

async function enrollFaceProfile(req, res, next) {
  try {
    const result = await faceProfiles.enroll({
      ...context(req),
      descriptor: req.body?.descriptor,
      modelId: req.body?.modelId,
      consent: req.body?.consent,
    });
    res.status(200).json({
      success: true,
      message: result.replaced ? "Face profile updated." : "Face profile enrolled.",
    });
  } catch (error) {
    next(error);
  }
}

async function removeFaceProfile(req, res, next) {
  try {
    const removed = await faceProfiles.remove(context(req));
    res.status(removed ? 200 : 404).json({
      success: removed,
      message: removed ? "Face profile removed." : "Face profile not found at this hospital.",
    });
  } catch (error) {
    next(error);
  }
}

async function getFaceProfileStatus(req, res, next) {
  try {
    const data = await faceProfiles.status(context(req));
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = { enrollFaceProfile, removeFaceProfile, getFaceProfileStatus };
