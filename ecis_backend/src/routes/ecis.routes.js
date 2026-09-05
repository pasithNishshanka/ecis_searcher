const express = require("express");
const router = express.Router();

const { searchECISCandidates } = require("../controllers/ecis.controller");

const { validateECISSearch } = require("../middleware/ecis.validation");

router.post("/search", validateECISSearch, searchECISCandidates);

module.exports = router;
