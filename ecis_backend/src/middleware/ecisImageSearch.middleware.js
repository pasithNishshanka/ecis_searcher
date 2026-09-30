const path = require("path");
const multer = require("multer");
const {
  MAX_IMAGE_SIZE_BYTES,
  detectMimeType,
} = require("./radiologyUpload.middleware");

function invalidImage(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.expose = true;
  return error;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: 1 },
}).single("image");

function uploadECISSearchImage(req, res, next) {
  upload(req, res, (error) => {
    if (error) {
      return next(invalidImage(
        error.code === "LIMIT_FILE_SIZE"
          ? "The image must be 20 MB or smaller."
          : "Select one image to search.",
      ));
    }

    if (!req.file?.buffer?.length) {
      return next(invalidImage("Select an image to search."));
    }

    const detectedType = detectMimeType(req.file.buffer);
    const declaredType = req.file.mimetype;
    const dicomOctetStream =
      detectedType === "application/dicom" &&
      declaredType === "application/octet-stream" &&
      path.extname(req.file.originalname || "").toLowerCase() === ".dcm";

    if (!detectedType || (detectedType !== declaredType && !dicomOctetStream)) {
      return next(invalidImage(
        "Select a valid JPEG, PNG, WebP, or DICOM file. The file contents must match its type.",
      ));
    }

    req.file.detectedMimeType = detectedType;
    return next();
  });
}

module.exports = { uploadECISSearchImage };
