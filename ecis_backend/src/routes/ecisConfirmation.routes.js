const express = require("express");

const router = express.Router();

const {
  confirmIdentity,
} = require("../controllers/ecisConfirmation.controller");

router.post("/confirm", confirmIdentity);

module.exports = router;
