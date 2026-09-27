const radiologyService =
  require("../services/radiology.service");

const fs = require("fs");

const {
  getStoragePath,
  removeUploadedFiles,
} = require("../middleware/radiologyUpload.middleware");

async function getPatientEncounters(
  req,
  res,
  next,
) {
  try {
    const data =
      await radiologyService.getPatientEncounters(
        req.params.patientId,
        req.user.hospitalId,
      );

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function getPatientOrders(
  req,
  res,
  next,
) {
  try {
    const data =
      await radiologyService.getPatientOrders(
        req.params.patientId,
        req.user.hospitalId,
      );

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function getOrderById(
  req,
  res,
  next,
) {
  try {
    const data =
      await radiologyService.getOrderById(
        req.params.investigationId,
        req.user.hospitalId,
      );

    if (!data) {
      return res.status(404).json({
        success: false,
        message:
          "Radiology order not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function createOrder(
  req,
  res,
  next,
) {
  try {
    const data =
      await radiologyService.createOrder(
        req.body || {},
        req.user,
      );

    return res.status(201).json({
      success: true,
      message:
        "Radiology investigation requested successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function recordReport(
  req,
  res,
  next,
) {
  try {
    const data =
      await radiologyService.recordReport(
        req.params.investigationId,
        req.body || {},
        req.user,
      );

    return res.status(200).json({
      success: true,
      message:
        "Radiology report recorded successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function verifyReport(
  req,
  res,
  next,
) {
  try {
    const data =
      await radiologyService.verifyReport(
        req.params.investigationId,
        req.user,
      );

    return res.status(200).json({
      success: true,
      message:
        "Radiology report verified successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function uploadOrderImages(
  req,
  res,
  next,
) {
  let imagesPersisted = false;

  try {
    const data =
      await radiologyService.attachImages(
        req.params.investigationId,
        req.files,
        req.user,
      );

    imagesPersisted = true;

    return res.status(201).json({
      success: true,
      message: "Radiology image upload completed successfully.",
      count: data.length,
      data,
    });
  } catch (error) {
    if (!imagesPersisted) {
      await removeUploadedFiles(req.files);
    }

    next(error);
  }
}

async function getOrderImages(
  req,
  res,
  next,
) {
  try {
    const data =
      await radiologyService.getOrderImages(
        req.params.investigationId,
        req.user.hospitalId,
      );

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function streamImage(
  req,
  res,
  next,
) {
  try {
    const image =
      await radiologyService.getImageFile(
        req.params.radiologyImageId,
        req.user.hospitalId,
      );

    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Radiology image not found.",
      });
    }

    const filePath = getStoragePath(
      image.storage_key,
    );

    try {
      await fs.promises.access(
        filePath,
        fs.constants.R_OK,
      );
    } catch {
      return res.status(404).json({
        success: false,
        message: "Radiology image file is unavailable.",
      });
    }

    const downloadRequested =
      req.query.download === "1";

    const isDicom =
      image.mime_type === "application/dicom";

    const safeFilename = String(
      image.original_filename,
    ).replace(
      /[\\"\r\n]/g,
      "_",
    );

    await radiologyService.recordImageAccess(
      image.radiology_image_id,
      req.user.userId,
      downloadRequested || isDicom
        ? "DOWNLOAD"
        : "VIEW",
    );

    res.set({
      "Content-Type": image.mime_type,
      "Content-Length": String(image.size_bytes),
      "Content-Disposition": `${
        downloadRequested || isDicom
          ? "attachment"
          : "inline"
      }; filename="${safeFilename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });

    return res.sendFile(
      filePath,
      (error) => {
        if (error) {
          next(error);
        }
      },
    );
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPatientEncounters,
  getPatientOrders,
  getOrderById,
  createOrder,
  recordReport,
  verifyReport,
  uploadOrderImages,
  getOrderImages,
  streamImage,
};
