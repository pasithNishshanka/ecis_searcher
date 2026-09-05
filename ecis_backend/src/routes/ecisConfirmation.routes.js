const express = require("express");

const router = express.Router();

const {
  confirmIdentity,
} = require(
  "../controllers/ecisConfirmation.controller",
);

const {
  authenticate,
} = require("../middleware/auth.middleware");

const {
  authorizeRoles,
} = require(
  "../middleware/authorization.middleware",
);

router.post(
  "/confirm",
  authenticate,
  authorizeRoles("DOCTOR"),
  confirmIdentity,
);

module.exports = router;