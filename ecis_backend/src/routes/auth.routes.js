const express = require("express");

const router = express.Router();

const {
  login,
  refresh,
  switchHospital,
  getContext,
  logout,
} = require("../controllers/auth.controller");

const {
  authenticate,
} = require("../middleware/auth.middleware");

router.post(
  "/login",
  login,
);

router.post(
  "/refresh",
  refresh,
);

router.get(
  "/context",
  authenticate,
  getContext,
);

router.post(
  "/switch-hospital",
  authenticate,
  switchHospital,
);

router.post(
  "/logout",
  logout,
);

module.exports = router;
