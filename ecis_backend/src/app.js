const express = require("express");
const cors = require("cors");

const patientRoutes = require("./routes/patient.routes");
const opdRoutes = require("./routes/opd.routes");
const treatmentRoutes = require("./routes/treatment.routes");
const clinicalObservationRoutes = require("./routes/clinicalObservation.routes");
const investigationRoutes = require("./routes/investigation.routes");
const conditionRoutes = require("./routes/condition.routes");
const surgeryRoutes = require("./routes/surgery.routes");
const procedureRoutes = require("./routes/procedure.routes");
const fractureRoutes = require("./routes/fracture.routes");
const dentalRecordRoutes = require("./routes/dentalRecord.routes");
const medicalDeviceRoutes = require("./routes/medicalDevice.routes");
const wardRoutes = require("./routes/ward.routes");
const admissionRoutes = require("./routes/admission.routes");
const clinicRoutes = require("./routes/clinic.routes");
const emergencyRoutes = require("./routes/emergency.routes");
const ecisRoutes = require("./routes/ecis.routes");
const ecisReviewRoutes = require("./routes/ecisReview.routes");
const ecisConfirmationRoutes = require("./routes/ecisConfirmation.routes");
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

app.use("/api/surgeries", surgeryRoutes);

app.use("/api/procedures", procedureRoutes);

app.use("/api/fractures", fractureRoutes);

app.use("/api/dental-records", dentalRecordRoutes);

app.use("/api/medical-devices", medicalDeviceRoutes);

app.use("/api/wards", wardRoutes);

app.use("/api/admissions", admissionRoutes);

app.use("/api/clinics", clinicRoutes);

app.use("/api/emergency", emergencyRoutes);

app.use("/api/ecis", ecisRoutes);

app.use("/api/ecis", ecisReviewRoutes);

app.use("/api/ecis", ecisConfirmationRoutes);

app.use(errorHandler);

module.exports = app;
