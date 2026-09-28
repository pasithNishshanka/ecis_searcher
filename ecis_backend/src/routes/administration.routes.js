const express = require("express");

const {
  authorizeRoles,
} = require("../middleware/authorization.middleware");

const {
  getHospitals,
  createHospital,
  findStaff,
  createStaffAccount,
  saveAssignment,
} = require("../controllers/administration.controller");

const router = express.Router();

const MANAGE_ASSIGNMENTS = ["SYSTEM_ADMIN", "ADMIN", "HOSPITAL_ADMIN"];

router.get(
  "/hospitals",
  authorizeRoles(...MANAGE_ASSIGNMENTS),
  getHospitals,
);

router.post(
  "/hospitals",
  authorizeRoles("SYSTEM_ADMIN"),
  createHospital,
);

router.get(
  "/users",
  authorizeRoles(...MANAGE_ASSIGNMENTS),
  findStaff,
);

router.post(
  "/users",
  authorizeRoles(...MANAGE_ASSIGNMENTS),
  createStaffAccount,
);

router.post(
  "/assignments",
  authorizeRoles(...MANAGE_ASSIGNMENTS),
  saveAssignment,
);

module.exports = router;
