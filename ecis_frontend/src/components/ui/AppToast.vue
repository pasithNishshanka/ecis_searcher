<template>
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="visible"
        class="fixed right-4 top-4 z-[100] w-[min(420px,calc(100vw-2rem))]"
        role="status"
        aria-live="polite"
      >
        <div
          class="rounded-2xl border bg-white p-4 shadow-xl"
          :class="toneClasses"
        >
          <div class="flex items-start gap-3">
            <div
              class="grid size-9 shrink-0 place-items-center rounded-xl text-white"
              :class="iconClasses"
            >
              {{ type === "success" ? "✓" : "!" }}
            </div>

            <div class="min-w-0 flex-1">
              <p class="font-bold text-slate-900">
                {{ title }}
              </p>

              <p
                v-if="message"
                class="mt-1 text-sm leading-5 text-slate-600"
              >
                {{ message }}
              </p>
            </div>

            <button
              type="button"
              class="text-slate-400 transition hover:text-slate-700"
              aria-label="Close message"
              @click="hide"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  watch,
} from "vue";

const props = withDefaults(
  defineProps<{
    visible: boolean;
    title?: string;
    message?: string;
    type?: "success" | "error";
    duration?: number;
  }>(),
  {
    title: "",
    message: "",
    type: "success",
    duration: 3500,
  },
);

const emit = defineEmits<{
  (event: "close"): void;
}>();

let timer: number | null = null;

const toneClasses = computed(() =>
  props.type === "error"
    ? "border-red-200"
    : "border-emerald-200",
);

const iconClasses = computed(() =>
  props.type === "error"
    ? "bg-red-600"
    : "bg-emerald-600",
);

function clearTimer() {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
}

function hide() {
  clearTimer();
  emit("close");
}

watch(
  () => [
    props.visible,
    props.message,
    props.duration,
  ],
  ([visible]) => {
    clearTimer();

    if (
      visible &&
      props.duration > 0
    ) {
      timer =
        window.setTimeout(() => {
          emit("close");
          timer = null;
        }, props.duration);
    }
  },
  {
    immediate: true,
  },
);

onBeforeUnmount(() => {
  clearTimer();
});
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>