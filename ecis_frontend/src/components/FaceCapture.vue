<template>
  <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <p class="text-sm font-bold text-slate-800">{{ label }}</p>
    <p class="mt-1 text-xs text-slate-500">{{ registrationPhoto ? "Choose a clear patient photo to save with the EHR. Face matching, when available, requires separate consent." : "Use one clear face. This search photo is processed on this device and is not saved." }}</p>
    <div class="mt-3 flex flex-wrap gap-2">
      <label class="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
        Choose photo
        <input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="user" @change="chooseFile" />
      </label>
      <button v-if="!cameraOn" type="button" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700" @click="startCamera">Use camera</button>
      <button v-else type="button" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700" @click="stopCamera">Stop camera</button>
      <button v-if="previewUrl" type="button" class="text-sm font-semibold text-slate-600 underline" @click="clear">Clear</button>
    </div>
    <div v-if="cameraOn" class="mt-3">
      <video ref="video" autoplay playsinline muted class="max-h-72 w-full rounded-lg bg-black object-contain"></video>
      <button type="button" class="mt-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white" @click="capture">Capture face</button>
    </div>
    <img v-if="previewUrl" :src="previewUrl" alt="Selected face photo preview" class="mt-3 max-h-56 w-full rounded-lg object-contain" />
    <p v-if="processing" class="mt-2 text-sm text-slate-600">Processing photo locally…</p>
    <p v-else-if="descriptorReady" class="mt-2 text-sm font-semibold text-teal-700">Face clue ready</p>
    <p v-else-if="photoReady && registrationPhoto" class="mt-2 text-sm font-semibold text-teal-700">Patient photo ready to save</p>
    <p v-if="error" class="mt-2 text-sm text-red-700" role="alert">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from "vue";
import { descriptorFromImage } from "../services/faceRecognition";

const props = withDefaults(defineProps<{ label: string; registrationPhoto?: boolean; detectFace?: boolean }>(), {
  registrationPhoto: false,
  detectFace: true,
});
const emit = defineEmits<{
  descriptor: [value: number[] | null];
  photo: [value: string | null];
  photoError: [value: string | null];
  processing: [value: boolean];
}>();
const video = ref<HTMLVideoElement | null>(null);
const cameraOn = ref(false);
const processing = ref(false);
const descriptorReady = ref(false);
const photoReady = ref(false);
const error = ref("");
const previewUrl = ref("");
let stream: MediaStream | null = null;
let generation = 0;

function clear() {
  generation += 1;
  stopCamera();
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = "";
  descriptorReady.value = false;
  photoReady.value = false;
  error.value = "";
  emit("descriptor", null);
  emit("photo", null);
  emit("photoError", null);
}

async function photoForStorage(blob: Blob): Promise<string> {
  const source = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const scale = Math.min(1, 720 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to prepare the patient photo.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!jpeg || jpeg.size > 1_000_000) throw new Error("The patient photo is too large. Choose a smaller image.");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Unable to read the patient photo."));
      reader.readAsDataURL(jpeg);
    });
    return dataUrl.split(",", 2)[1] || "";
  } finally {
    URL.revokeObjectURL(source);
  }
}

async function process(blob: Blob) {
  clear();
  const attempt = generation;
  previewUrl.value = URL.createObjectURL(blob);
  processing.value = true;
  emit("processing", true);
  try {
    const photo = await photoForStorage(blob);
    if (attempt === generation) {
      emit("photo", photo);
      photoReady.value = true;
    }
    if (props.detectFace) {
      const descriptor = await descriptorFromImage(blob);
      if (attempt === generation) {
        emit("descriptor", descriptor);
        descriptorReady.value = true;
      }
    }
  } catch (cause) {
    if (attempt === generation) {
      error.value = photoReady.value && props.registrationPhoto
        ? "The photo is ready for the EHR, but the optional face clue could not be prepared."
        : cause instanceof Error ? cause.message : "Unable to process the face photo.";
      if (!photoReady.value && props.registrationPhoto) emit("photoError", error.value);
    }
  } finally {
    if (attempt === generation) {
      processing.value = false;
      emit("processing", false);
    }
  }
}

async function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) await process(file);
  input.value = "";
}

async function startCamera() {
  clear();
  const attempt = generation;
  try {
    const opened = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    if (attempt !== generation) {
      opened.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = opened;
    cameraOn.value = true;
    await nextTick();
    if (video.value) video.value.srcObject = stream;
  } catch {
    error.value = "Camera access is unavailable. Choose a photo instead.";
    if (props.registrationPhoto) emit("photoError", error.value);
    stopCamera();
  }
}

function stopCamera() {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  if (video.value) video.value.srcObject = null;
  cameraOn.value = false;
}

async function capture() {
  if (!video.value || !video.value.videoWidth || !video.value.videoHeight) {
    error.value = "Camera is not ready yet.";
    if (props.registrationPhoto) emit("photoError", error.value);
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.value.videoWidth;
  canvas.height = video.value.videoHeight;
  canvas.getContext("2d")?.drawImage(video.value, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  stopCamera();
  if (blob) await process(blob);
}

onBeforeUnmount(() => {
  generation += 1;
  stopCamera();
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  emit("photo", null);
  emit("processing", false);
});
</script>
