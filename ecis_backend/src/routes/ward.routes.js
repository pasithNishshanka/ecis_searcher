const express = require("express");

const {
  createWard,
  getWardsByHospital,
  createBed,
  getBedsByWard,
} = require("../controllers/ward.controller");

const router = express.Router();

/*
 * Authentication is already applied globally in app.js:
 *
 * app.use("/api", authenticate);
 *
 * Therefore these routes receive req.user.
 */

router.post("/", createWard);

router.get("/hospital/:hospitalId", getWardsByHospital);

router.post("/:wardId/beds", createBed);

router.get("/:wardId/beds", getBedsByWard);

module.exports = router;
