const clinicService =
  require("../services/clinic.service");


function getHospitalId(req) {
  const hospitalId =
    Number(
      req.user?.hospitalId,
    );

  return Number.isInteger(
    hospitalId,
  ) && hospitalId > 0
    ? hospitalId
    : null;
}


function getUserId(req) {
  const userId =
    Number(
      req.user?.userId,
    );

  return Number.isInteger(
    userId,
  ) && userId > 0
    ? userId
    : null;
}


function parsePositiveInteger(
  value,
) {
  const parsed =
    Number(value);

  return Number.isInteger(
    parsed,
  ) && parsed > 0
    ? parsed
    : null;
}


/* ============================================================
   CREATE CLINIC
   ============================================================ */

async function createClinic(
  req,
  res,
  next,
) {
  try {
    const hospitalId =
      getHospitalId(req);

    if (!hospitalId) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated hospital information is missing.",
      });
    }

    const clinicCode =
      String(
        req.body?.clinicCode ||
          "",
      ).trim();

    const clinicName =
      String(
        req.body?.clinicName ||
          "",
      ).trim();

    if (!clinicCode) {
      return res.status(400).json({
        success: false,
        message:
          "clinicCode is required.",
      });
    }

    if (!clinicName) {
      return res.status(400).json({
        success: false,
        message:
          "clinicName is required.",
      });
    }

    const clinic =
      await clinicService.createClinic({
        ...req.body,
        hospitalId,
      });

    return res.status(201).json({
      success: true,
      message:
        "Clinic created successfully.",
      data: clinic,
    });
  } catch (error) {
    if (
      error?.code ===
      "23505"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "A clinic with the same code already exists.",
      });
    }

    if (
      error?.message ===
        "clinicCode is required." ||
      error?.message ===
        "clinicName is required."
    ) {
      return res.status(400).json({
        success: false,
        message:
          error.message,
      });
    }

    next(error);
  }
}


/* ============================================================
   GET CLINICS
   ============================================================ */

async function getClinics(
  req,
  res,
  next,
) {
  try {
    const hospitalId =
      getHospitalId(req);

    if (!hospitalId) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated hospital information is missing.",
      });
    }

    const clinics =
      await clinicService.getClinicsByHospital(
        hospitalId,
      );

    return res.status(200).json({
      success: true,
      count: clinics.length,
      data: clinics,
    });
  } catch (error) {
    next(error);
  }
}


/* ============================================================
   BACKWARD COMPATIBLE HOSPITAL ENDPOINT
   ============================================================ */

async function getClinicsByHospital(
  req,
  res,
  next,
) {
  try {
    const authenticatedHospitalId =
      getHospitalId(req);

    const requestedHospitalId =
      parsePositiveInteger(
        req.params.hospitalId,
      );

    if (!authenticatedHospitalId) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated hospital information is missing.",
      });
    }

    if (!requestedHospitalId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid hospitalId is required.",
      });
    }

    if (
      requestedHospitalId !==
      authenticatedHospitalId
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot access another hospital's clinics.",
      });
    }

    const clinics =
      await clinicService.getClinicsByHospital(
        authenticatedHospitalId,
      );

    return res.status(200).json({
      success: true,
      count: clinics.length,
      data: clinics,
    });
  } catch (error) {
    next(error);
  }
}


/* ============================================================
   CREATE CLINIC VISIT
   ============================================================ */

async function createClinicVisit(
  req,
  res,
  next,
) {
  try {
    const hospitalId =
      getHospitalId(req);

    const doctorUserId =
      getUserId(req);

    if (
      !hospitalId ||
      !doctorUserId
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated hospital/user information is missing.",
      });
    }

    const clinicId =
      parsePositiveInteger(
        req.body?.clinicId,
      );

    const patientId =
      parsePositiveInteger(
        req.body?.patientId,
      );

    if (!clinicId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid clinicId is required.",
      });
    }

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid patientId is required.",
      });
    }

    const result =
      await clinicService.createClinicVisit({
        ...req.body,

        clinicId,

        patientId,

        hospitalId,

        doctorUserId,
      });

    return res.status(201).json({
      success: true,
      message:
        "Clinic visit completed successfully.",
      data: result,
    });
  } catch (error) {
    if (
      error?.message ===
        "Clinic not found for the authenticated hospital." ||
      error?.message ===
        "Active patient not found for the authenticated hospital." ||
      error?.message ===
        "Authenticated clinician is not active in this hospital."
    ) {
      return res.status(409).json({
        success: false,
        message:
          error.message,
      });
    }

    if (
      error?.message ===
        "Reason for visit is required." ||
      error?.message ===
        "Diagnosis summary is required." ||
      error?.message ===
        "Follow-up date is required when follow-up is selected." ||
      error?.message?.includes(
        "is invalid.",
      ) ||
      error?.message ===
        "Only a doctor can complete a clinic consultation."
    ) {
      return res.status(400).json({
        success: false,
        message:
          error.message,
      });
    }

    if (
      error?.code ===
      "23505"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This clinic visit number already exists. Please retry the consultation.",
      });
    }

    next(error);
  }
}


/* ============================================================
   CLINIC HISTORY
   ============================================================ */

async function getPatientClinicHistory(
  req,
  res,
  next,
) {
  try {
    const hospitalId =
      getHospitalId(req);

    if (!hospitalId) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated hospital information is missing.",
      });
    }

    const patientId =
      parsePositiveInteger(
        req.params.patientId,
      );

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid patientId is required.",
      });
    }

    const history =
      await clinicService.getPatientClinicHistory(
        patientId,
        hospitalId,
      );

    return res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    next(error);
  }
}


module.exports = {
  createClinic,
  getClinics,
  getClinicsByHospital,
  createClinicVisit,
  getPatientClinicHistory,
};