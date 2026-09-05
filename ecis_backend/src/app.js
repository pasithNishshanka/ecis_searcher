const express = require("express");
const cors = require("cors");

const patientRoutes = require("./routes/patient.routes");
const opdRoutes = require("./routes/opd.routes");
const treatmentRoutes = require("./routes/treatment.routes");
const clinicalObservationRoutes = require("./routes/clinicalObservation.routes");
const investigationRoutes = require("./routes/investigation.routes");
const conditionRoutes = require("./routes/condition.routes");
const errorHandler = require("./middleware/error.middleware");

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ECIS backend is running",
  });
});

app.use("/api/patients", patientRoutes);

app.use("/api/opd", opdRoutes);

app.use("/api/treatments", treatmentRoutes);

app.use("/api/clinical-observations", clinicalObservationRoutes);

app.use("/api/investigations", investigationRoutes);

app.use("/api/conditions", conditionRoutes);

app.use(errorHandler);

module.exports = app;
