const express = require("express");
const { getProviders } = require("../controllers/provider.controller");

const router = express.Router();
router.get("/", getProviders);

module.exports = router;
