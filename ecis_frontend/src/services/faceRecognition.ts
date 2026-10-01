// All inference runs in the browser. The source image is never sent to ECIS.
export const FACE_MODEL_ID = "face-api-1.7.15-ssd-68-recognition";

let modelsPromise: Promise<typeof import("@vladmandic/face-api")> | null = null;

async function loadModels() {
  if (!modelsPromise) {
    modelsPromise = (async () => {
      const faceapi = await import("@vladmandic/face-api");
      const modelPath = `${import.meta.env.BASE_URL}face-models`;
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelPath),
      ]);
      return faceapi;
    })().catch((error) => {
      modelsPromise = null;
      throw error;
    });
  }
  return modelsPromise;
}

export async function descriptorFromImage(blob: Blob): Promise<number[]> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(blob.type) || blob.size > 5 * 1024 * 1024) {
    throw new Error("Choose a JPEG, PNG or WebP photo under 5 MB.");
  }
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    if (image.naturalWidth < 300 || image.naturalHeight < 300) {
      throw new Error("Use a clearer image at least 300 × 300 pixels.");
    }
    const faceapi = await loadModels();
    const detections = await faceapi.detectAllFaces(image)
      .withFaceLandmarks()
      .withFaceDescriptors();
    if (detections.length !== 1) {
      throw new Error(detections.length ? "Use a photo showing only one person." : "No face was detected. Try better lighting and a frontal view.");
    }
    const match = detections[0];
    if (match.detection.score < 0.8 || match.detection.box.width < 100 || match.detection.box.height < 100) {
      throw new Error("Face quality is too low. Retake the photo closer and in better light.");
    }
    const descriptor = Array.from(match.descriptor);
    if (descriptor.length !== 128 || descriptor.some((value) => !Number.isFinite(value))) {
      throw new Error("The face descriptor could not be generated.");
    }
    return descriptor;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
