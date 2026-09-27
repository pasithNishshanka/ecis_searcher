const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const multer = require("multer");

const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGES_PER_ORDER = 10;

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/dicom",
]);

const fileExtensions = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/dicom": ".dcm",
};

const storageDirectory = path.resolve(
  process.env.RADIOLOGY_IMAGE_STORAGE_PATH ||
    path.join(__dirname, "../../storage/radiology"),
);

fs.mkdirSync(storageDirectory, {
  recursive: true,
});

function createUploadError(message) {
  const error = new Error(message);

  error.statusCode = 400;
  error.expose = true;

  return error;
}

function getStoragePath(storageKey) {
  const resolvedPath = path.resolve(
    storageDirectory,
    storageKey,
  );

  if (
    !resolvedPath.startsWith(
      `${storageDirectory}${path.sep}`,
    )
  ) {
    throw new Error("Invalid radiology image storage key.");
  }

  return resolvedPath;
}

async function removeUploadedFiles(files = []) {
  await Promise.all(
    files.map(async (file) => {
      if (!file?.path) {
        return;
      }

      try {
        await fs.promises.unlink(file.path);
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.error(
            "Unable to remove rejected radiology upload:",
            error.message,
          );
        }
      }
    }),
  );
}

async function readSignature(filePath) {
  const handle = await fs.promises.open(filePath, "r");

  try {
    const signature = Buffer.alloc(132);

    await handle.read(signature, 0, signature.length, 0);

    return signature;
  } finally {
    await handle.close();
  }
}

function detectMimeType(signature) {
  if (
    signature[0] === 0xff &&
    signature[1] === 0xd8 &&
    signature[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    signature.subarray(0, 8).equals(
      Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
      ]),
    )
  ) {
    return "image/png";
  }

  if (
    signature.subarray(0, 4).toString() === "RIFF" &&
    signature.subarray(8, 12).toString() === "WEBP"
  ) {
    return "image/webp";
  }

  if (
    signature.subarray(128, 132).toString() === "DICM"
  ) {
    return "application/dicom";
  }

  return null;
}

async function validateUploadedFiles(files) {
  for (const file of files) {
    const detectedMimeType = detectMimeType(
      await readSignature(file.path),
    );

    if (!detectedMimeType) {
      throw createUploadError(
        `"${file.originalname}" is not a supported image file.`,
      );
    }

    if (detectedMimeType !== file.mimetype) {
      throw createUploadError(
        `"${file.originalname}" does not match its declared file type.`,
      );
    }
  }
}

const storage = multer.diskStorage({
  destination: (
    _request,
    _file,
    callback,
  ) => {
    callback(null, storageDirectory);
  },

  filename: (
    _request,
    file,
    callback,
  ) => {
    const extension =
      fileExtensions[file.mimetype];

    if (!extension) {
      callback(
        createUploadError("Unsupported radiology image type."),
      );

      return;
    }

    callback(
      null,
      `${crypto.randomUUID()}${extension}`,
    );
  },
});

const multerUpload = multer({
  storage,

  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: MAX_IMAGES_PER_ORDER,
  },

  fileFilter: (
    _request,
    file,
    callback,
  ) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(
        createUploadError(
          "Only JPEG, PNG, WebP, and DICOM radiology images are accepted.",
        ),
      );

      return;
    }

    callback(null, true);
  },
});

function uploadRadiologyImages(
  request,
  response,
  next,
) {
  multerUpload.array(
    "images",
    MAX_IMAGES_PER_ORDER,
  )(
    request,
    response,
    async (error) => {
      if (error) {
        await removeUploadedFiles(request.files);

        if (error instanceof multer.MulterError) {
          next(
            createUploadError(
              error.code === "LIMIT_FILE_SIZE"
                ? "Each radiology image must be 20 MB or smaller."
                : "Radiology image upload is invalid.",
            ),
          );

          return;
        }

        next(error);

        return;
      }

      if (!request.files?.length) {
        next(
          createUploadError(
            "At least one radiology image is required.",
          ),
        );

        return;
      }

      try {
        await validateUploadedFiles(request.files);

        next();
      } catch (validationError) {
        await removeUploadedFiles(request.files);

        next(validationError);
      }
    },
  );
}

module.exports = {
  MAX_IMAGE_SIZE_BYTES,
  uploadRadiologyImages,
  removeUploadedFiles,
  getStoragePath,
};
