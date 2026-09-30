const administrationService = require("../services/administration.service");

function statusForError(error) {
  if (error?.code === "23505") {
    return 409;
  }

  const message = String(error?.message || "");

  if (
    message.includes("required") ||
    message.includes("must be") ||
    message.includes("cannot be") ||
    message.includes("not available") ||
    message.includes("at least two") ||
    message.includes("provisioned separately")
  ) {
    return 400;
  }

  if (
    message.includes("only manage") ||
    message.includes("cannot grant") ||
    message.includes("only create") ||
    message.includes("Only a system") ||
    message.includes("Only the current")
  ) {
    return 403;
  }

  if (
    message.includes("does not exist") ||
    message.includes("inactive") ||
    message.includes("already uses")
  ) {
    return 409;
  }

  return 500;
}

async function getHospitals(req, res, next) {
  try {
    const hospitals = await administrationService.listHospitals();
    return res.status(200).json({ success: true, count: hospitals.length, data: hospitals });
  } catch (error) {
    next(error);
  }
}

async function createHospital(req, res, next) {
  try {
    const hospital = await administrationService.createHospital(req.body || {});
    return res.status(201).json({ success: true, message: "Hospital created.", data: hospital });
  } catch (error) {
    const status = statusForError(error);
    if (status === 500) {
      return next(error);
    }
    return res.status(status).json({ success: false, message: error.message });
  }
}

async function findStaff(req, res, next) {
  try {
    const staff = await administrationService.searchStaff(req.query?.q);
    return res.status(200).json({ success: true, count: staff.length, data: staff });
  } catch (error) {
    const status = statusForError(error);
    if (status === 500) {
      return next(error);
    }
    return res.status(status).json({ success: false, message: error.message });
  }
}

async function createStaffAccount(req, res, next) {
  try {
    const staff = await administrationService.createStaffAccount({
      actor: req.user,
      input: req.body || {},
    });

    return res.status(201).json({
      success: true,
      message: "Staff login and hospital assignment created.",
      data: staff,
    });
  } catch (error) {
    const status = statusForError(error);
    if (status === 500) {
      return next(error);
    }
    return res.status(status).json({ success: false, message: error.message });
  }
}

async function saveAssignment(req, res, next) {
  try {
    const assignment = await administrationService.createOrUpdateAssignment({
      actor: req.user,
      input: req.body || {},
    });

    return res.status(201).json({
      success: true,
      message: "Hospital assignment saved.",
      data: assignment,
    });
  } catch (error) {
    const status = statusForError(error);
    if (status === 500) {
      return next(error);
    }
    return res.status(status).json({ success: false, message: error.message });
  }
}

module.exports = {
  getHospitals,
  createHospital,
  findStaff,
  createStaffAccount,
  saveAssignment,
};
