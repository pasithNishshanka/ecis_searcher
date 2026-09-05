const express = require("express");
const router = express.Router();

const { searchECISCandidates } = require("../controllers/ecis.controller");

router.post("/search", searchECISCandidates);

module.exports = router;
