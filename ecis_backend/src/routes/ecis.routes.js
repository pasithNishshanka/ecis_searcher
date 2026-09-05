const express = require("express");

const router = express.Router();

const { searchECISCandidates } = require("../controllers/ecis.controller");

const { validateECISSearch } = require("../middleware/ecis.validation");

const { authenticate } = require("../middleware/auth.middleware");

const { authorizeRoles } = require("../middleware/authorization.middleware");

/*
 * ECIS candidate search
 *
 * Currently only DOCTOR is authorized.
 */
router.post(
  "/search",
  authenticate,
  authorizeRoles("DOCTOR"),
  validateECISSearch,
  searchECISCandidates,
);

module.exports = router;
