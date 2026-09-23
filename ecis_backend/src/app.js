const express =
  require("express");

const cors =
  require("cors");


/* ============================================================
   ROUTES
   ============================================================ */

const patientRoutes =
  require("./routes/patient.routes");

const opdRoutes =
  require("./routes/opd.routes");

const treatmentRoutes =
  require("./routes/treatment.routes");

const clinicalObservationRoutes =
  require("./routes/clinicalObservation.routes");

const investigationRoutes =
  require("./routes/investigation.routes");

const conditionRoutes =
  require("./routes/condition.routes");

const surgeryRoutes =
  require("./routes/surgery.routes");

const procedureRoutes =
  require("./routes/procedure.routes");

const fractureRoutes =
  require("./routes/fracture.routes");

const dentalRecordRoutes =
  require("./routes/dentalRecord.routes");

const medicalDeviceRoutes =
  require("./routes/medicalDevice.routes");

const wardRoutes =
  require("./routes/ward.routes");

const admissionRoutes =
  require("./routes/admission.routes");

const clinicRoutes =
  require("./routes/clinic.routes");

const emergencyRoutes =
  require("./routes/emergency.routes");

const ecisRoutes =
  require("./routes/ecis.routes");

const ecisReviewRoutes =
  require("./routes/ecisReview.routes");

const ecisConfirmationRoutes =
  require("./routes/ecisConfirmation.routes");

const authRoutes =
  require("./routes/auth.routes");

const pharmacyRoutes =
  require("./routes/pharmacy.routes");

const bhtRoutes =
  require("./routes/bht.routes");

const labRoutes =
  require("./routes/lab.routes");

const radiologyRoutes =
  require("./routes/radiology.routes");

const medicalRecordRoutes =
  require("./routes/medicalRecord.routes");


/* ============================================================
   MIDDLEWARE
   ============================================================ */

const errorHandler =
  require("./middleware/error.middleware");

const {
  authenticate,
} =
  require("./middleware/auth.middleware");


/* ============================================================
   APP
   ============================================================ */

const app =
  express();


/* ============================================================
   CORS
   ============================================================ */

const configuredOrigins =
  String(
    process.env.FRONTEND_ORIGINS ||
      "http://localhost:5173",
  )
    .split(",")
    .map(
      (origin) =>
        origin.trim(),
    )
    .filter(
      Boolean,
    );


app.use(
  cors({
    origin(
      origin,
      callback,
    ) {
      if (
        !origin ||
        configuredOrigins.includes(
          "*",
        ) ||
        configuredOrigins.includes(
          origin,
        )
      ) {
        return callback(
          null,
          true,
        );
      }


      return callback(
        new Error(
          "Origin is not allowed by CORS.",
        ),
      );
    },

    credentials:
      true,
  }),
);


/* ============================================================
   JSON
   ============================================================ */

app.use(
  express.json({
    limit:
      "2mb",
  }),
);


/* ============================================================
   HEALTH
   ============================================================ */

app.get(
  "/api/health",
  (
    req,
    res,
  ) => {
    res.status(
      200,
    ).json({
      success:
        true,

      message:
        "ECIS backend is running",
    });
  },
);


/* ============================================================
   PUBLIC AUTHENTICATION
   ============================================================ */

app.use(
  "/api/auth",
  authRoutes,
);


/* ============================================================
   AUTHENTICATION FOR EVERYTHING ELSE
   ============================================================ */

app.use(
  "/api",
  authenticate,
);


/* ============================================================
   PATIENTS
   ============================================================ */

app.use(
  "/api/patients",
  patientRoutes,
);


/* ============================================================
   OPD
   ============================================================ */

app.use(
  "/api/opd",
  opdRoutes,
);


/* ============================================================
   TREATMENTS
   ============================================================ */

app.use(
  "/api/treatments",
  treatmentRoutes,
);


/* ============================================================
   CLINICAL OBSERVATIONS
   ============================================================ */

app.use(
  "/api/clinical-observations",
  clinicalObservationRoutes,
);


/* ============================================================
   INVESTIGATIONS
   ============================================================ */

app.use(
  "/api/investigations",
  investigationRoutes,
);


/* ============================================================
   CONDITIONS
   ============================================================ */

app.use(
  "/api/conditions",
  conditionRoutes,
);


/* ============================================================
   SURGERIES
   ============================================================ */

app.use(
  "/api/surgeries",
  surgeryRoutes,
);


/* ============================================================
   PROCEDURES
   ============================================================ */

app.use(
  "/api/procedures",
  procedureRoutes,
);


/* ============================================================
   FRACTURES
   ============================================================ */

app.use(
  "/api/fractures",
  fractureRoutes,
);


/* ============================================================
   DENTAL RECORDS
   ============================================================ */

app.use(
  "/api/dental-records",
  dentalRecordRoutes,
);


/* ============================================================
   MEDICAL DEVICES
   ============================================================ */

app.use(
  "/api/medical-devices",
  medicalDeviceRoutes,
);


/* ============================================================
   WARDS
   ============================================================ */

app.use(
  "/api/wards",
  wardRoutes,
);


/* ============================================================
   ADMISSIONS
   ============================================================ */

app.use(
  "/api/admissions",
  admissionRoutes,
);


/* ============================================================
   CLINICS
   ============================================================ */

app.use(
  "/api/clinics",
  clinicRoutes,
);


/* ============================================================
   EMERGENCY
   ============================================================ */

app.use(
  "/api/emergency",
  emergencyRoutes,
);


/* ============================================================
   PHARMACY / MEDICATION
   ============================================================ */

app.use(
  "/api/pharmacy",
  pharmacyRoutes,
);


/* ============================================================
   BHT / BED HEAD TICKET
   ============================================================ */

app.use(
  "/api/bht",
  bhtRoutes,
);


/* ============================================================
   LABORATORY
   ============================================================ */

app.use(
  "/api/lab",
  labRoutes,
);


/* ============================================================
   RADIOLOGY / IMAGING
   ============================================================ */

app.use(
  "/api/radiology",
  radiologyRoutes,
);


/* ============================================================
   MEDICAL RECORDS / LONGITUDINAL EHR
   ============================================================ */

app.use(
  "/api/medical-records",
  medicalRecordRoutes,
);


/* ============================================================
   ECIS
   ============================================================ */

app.use(
  "/api/ecis",
  ecisRoutes,
);

app.use(
  "/api/ecis",
  ecisReviewRoutes,
);

app.use(
  "/api/ecis",
  ecisConfirmationRoutes,
);


/* ============================================================
   ERROR HANDLER
   ============================================================ */

app.use(
  errorHandler,
);


/* ============================================================
   EXPORT
   ============================================================ */

module.exports =
  app;