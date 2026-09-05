const express = require("express");

const {
  createWard,
  getWardsByHospital,
  createBed,
  getBedsByWard,
} = require("../controllers/ward.controller");

const router = express.Router();

router.post("/", createWard);

router.get("/hospital/:hospitalId", getWardsByHospital);

router.post("/:wardId/beds", createBed);

router.get("/:wardId/beds", getBedsByWard);

module.exports = router;
