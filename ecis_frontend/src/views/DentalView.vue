<template>
  <div>
    <PageHeader
      eyebrow="Dental Clinic"
      title="Dental consultations"
      description="Record and review dental examinations and treatments in the selected patient's existing hospital EHR."
    >
      <BaseButton
        :disabled="!selected"
        @click="openForm"
      >
        <template #icon>
          <Plus :size="16" />
        </template>

        New dental consultation
      </BaseButton>
    </PageHeader>

    <div
      v-if="message"
      :class="[
        'mb-5 rounded-xl border p-4 text-sm',
        messageType === 'error'
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-teal-200 bg-teal-50 text-teal-800',
      ]"
    >
      {{ message }}
    </div>

    <div class="grid gap-6 xl:grid-cols-[340px_1fr]">
      <section class="card p-5">
        <h2 class="section-title text-base">
          Registered patients
        </h2>

        <p class="muted mt-1">
          Select an existing patient before recording a dental consultation.
        </p>

        <PatientLookup
          v-model="selected"
          :patients="patients"
          class="mt-4"
          label=""
          placeholder="Search name / ID / NIC"
        />

        <div
          v-if="!selected"
          class="mt-6 rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-400"
        >
          Search and select a registered patient to continue.
        </div>

        <div
          v-else
          class="mt-5 rounded-xl bg-teal-50 p-4"
        >
          <p class="text-xs font-black uppercase tracking-wider text-teal-700">
            Selected patient
          </p>

          <p class="mt-1 font-black text-teal-950">
            {{ selected.firstName }} {{ selected.lastName }}
          </p>

          <p class="text-xs text-teal-800">
            {{ selected.patientNumber }} · {{ selected.nic || "NIC not recorded" }}
          </p>
        </div>
      </section>

      <section
        v-if="selected"
        class="space-y-5"
      >
        <div class="card p-5">
          <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p class="text-xs font-black uppercase tracking-wider text-teal-700">
                Patient dental EHR
              </p>

              <h2 class="mt-1 section-title">
                {{ selected.firstName }} {{ selected.lastName }}
              </h2>

              <p class="muted">
                {{ selected.patientNumber }} · {{ patientAge === null ? "Age not recorded" : `${patientAge} years` }} · {{ selected.bloodGroup || "Blood group not recorded" }}
              </p>
            </div>

            <RouterLink :to="`/patients/${selected.id}`">
              <BaseButton variant="secondary">
                Open full EHR
                <ArrowRight :size="15" />
              </BaseButton>
            </RouterLink>
          </div>
        </div>

        <div class="card overflow-hidden">
          <div class="border-b p-5">
            <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 class="section-title">
                  Dental consultation history
                </h2>

                <p class="muted mt-1">
                  These records are stored in the selected patient's EHR and are available to ECIS searches.
                </p>
              </div>

              <StatusBadge
                tone="info"
                :label="`${records.length} record${records.length === 1 ? '' : 's'}`"
              />
            </div>
          </div>

          <div
            v-if="loadingHistory"
            class="p-10 text-center text-sm text-slate-400"
          >
            Loading dental consultation history...
          </div>

          <div
            v-else-if="records.length"
            class="divide-y divide-slate-100"
          >
            <article
              v-for="record in records"
              :key="record.dental_record_id"
              class="p-5"
            >
              <div class="flex flex-col justify-between gap-3 sm:flex-row">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      tone="info"
                      :label="record.tooth_number ? `Tooth ${record.tooth_number}` : 'Dental record'"
                    />

                    <span
                      v-if="record.crown_present"
                      class="badge bg-amber-50 text-amber-800"
                    >
                      Crown
                    </span>

                    <span
                      v-if="record.implant_present"
                      class="badge bg-violet-50 text-violet-800"
                    >
                      Implant
                    </span>

                    <span
                      v-if="record.missing_tooth"
                      class="badge bg-slate-100 text-slate-700"
                    >
                      Missing tooth
                    </span>
                  </div>

                  <h3 class="mt-2 font-bold text-slate-900">
                    {{ record.condition || "Condition not recorded" }}
                  </h3>

                  <p class="mt-1 text-sm text-slate-500">
                    {{ record.treatment || "Treatment not recorded" }}
                  </p>
                </div>

                <p class="text-xs text-slate-400 sm:text-right">
                  {{ formatDate(record.record_date) }}
                </p>
              </div>

              <dl class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div class="rounded-xl bg-slate-50 p-3">
                  <dt class="label">Filling type</dt>
                  <dd class="mt-1 text-sm font-semibold text-slate-700">
                    {{ record.filling_type || "Not recorded" }}
                  </dd>
                </div>

                <div class="rounded-xl bg-slate-50 p-3">
                  <dt class="label">Crown present</dt>
                  <dd class="mt-1 text-sm font-semibold text-slate-700">
                    {{ yesNo(record.crown_present) }}
                  </dd>
                </div>

                <div class="rounded-xl bg-slate-50 p-3">
                  <dt class="label">Implant present</dt>
                  <dd class="mt-1 text-sm font-semibold text-slate-700">
                    {{ yesNo(record.implant_present) }}
                  </dd>
                </div>

                <div class="rounded-xl bg-slate-50 p-3">
                  <dt class="label">Recorded by</dt>
                  <dd class="mt-1 text-sm font-semibold text-slate-700">
                    {{ record.recorded_by_name || "Not recorded" }}
                  </dd>
                </div>
              </dl>

              <div
                v-if="record.notes"
                class="mt-3 rounded-xl bg-slate-50 p-3"
              >
                <p class="label">Clinical notes</p>
                <p class="mt-1 whitespace-pre-line text-sm text-slate-700">
                  {{ record.notes }}
                </p>
              </div>
            </article>
          </div>

          <div
            v-else
            class="p-10 text-center text-sm text-slate-400"
          >
            No dental consultations have been recorded for this patient yet.
          </div>
        </div>
      </section>

      <section
        v-else
        class="card grid place-items-center p-16 text-center"
      >
        <div>
          <div class="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-50 text-teal-700">
            <ClipboardPlus :size="26" />
          </div>

          <h2 class="mt-4 font-bold">
            Select a registered patient
          </h2>

          <p class="mt-1 text-sm text-slate-400">
            The patient's dental consultation history will appear here.
          </p>
        </div>
      </section>
    </div>

    <Modal
      :open="formOpen"
      title="New dental consultation"
      description="The authenticated hospital clinician is recorded by the backend; this form does not choose a clinician ID."
      @close="closeForm"
    >
      <form
        v-if="selected"
        class="grid gap-4 sm:grid-cols-2"
        @submit.prevent="save"
      >
        <div class="sm:col-span-2 rounded-xl bg-teal-50 p-4">
          <p class="text-xs font-black uppercase tracking-wider text-teal-700">
            Patient
          </p>

          <p class="mt-1 font-black text-teal-950">
            {{ selected.firstName }} {{ selected.lastName }}
          </p>

          <p class="text-xs text-teal-800">
            {{ selected.patientNumber }}
          </p>
        </div>

        <FormField
          label="Consultation date"
          required
        >
          <BaseInput
            v-model="form.recordDate"
            type="date"
            required
            :disabled="saving"
          />
        </FormField>

        <FormField
          label="Tooth number"
          required
          hint="Use the FDI number, for example 11 or 36."
        >
          <BaseInput
            v-model="form.toothNumber"
            required
            placeholder="11"
            :disabled="saving"
          />
        </FormField>

        <FormField
          label="Clinical condition"
          required
        >
          <BaseInput
            v-model="form.condition"
            required
            placeholder="For example: caries, crown review, missing tooth"
            :disabled="saving"
          />
        </FormField>

        <FormField
          label="Treatment provided"
          required
        >
          <BaseInput
            v-model="form.treatment"
            required
            placeholder="For example: restoration, extraction, scaling"
            :disabled="saving"
          />
        </FormField>

        <div class="sm:col-span-2">
          <FormField label="Filling type">
            <BaseInput
              v-model="form.fillingType"
              placeholder="For example: composite resin, amalgam, glass ionomer"
              :disabled="saving"
            />
          </FormField>
        </div>

        <div class="sm:col-span-2 grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-3">
          <label class="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <input
              v-model="form.crownPresent"
              type="checkbox"
              class="size-4 rounded border-slate-300 text-teal-600"
              :disabled="saving"
            />
            Crown present
          </label>

          <label class="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <input
              v-model="form.implantPresent"
              type="checkbox"
              class="size-4 rounded border-slate-300 text-teal-600"
              :disabled="saving"
            />
            Implant present
          </label>

          <label class="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <input
              v-model="form.missingTooth"
              type="checkbox"
              class="size-4 rounded border-slate-300 text-teal-600"
              :disabled="saving"
            />
            Missing tooth
          </label>
        </div>

        <div class="sm:col-span-2">
          <FormField label="Clinical notes">
            <BaseTextarea
              v-model="form.notes"
              rows="4"
              placeholder="Relevant examination findings, advice, referral or follow-up plan..."
              :disabled="saving"
            />
          </FormField>
        </div>

        <div class="sm:col-span-2 flex justify-end gap-2 border-t pt-4">
          <BaseButton
            type="button"
            variant="secondary"
            :disabled="saving"
            @click="closeForm"
          >
            Cancel
          </BaseButton>

          <BaseButton
            type="submit"
            :disabled="saving"
          >
            {{ saving ? "Saving..." : "Save dental consultation" }}
          </BaseButton>
        </div>
      </form>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  reactive,
  ref,
  watch,
} from "vue";

import {
  RouterLink,
} from "vue-router";

import {
  ArrowRight,
  ClipboardPlus,
  Plus,
} from "lucide-vue-next";

import PageHeader from "../components/PageHeader.vue";
import Modal from "../components/Modal.vue";
import BaseButton from "../components/ui/BaseButton.vue";
import BaseInput from "../components/ui/BaseInput.vue";
import BaseTextarea from "../components/ui/BaseTextarea.vue";
import StatusBadge from "../components/ui/StatusBadge.vue";
import FormField from "../components/forms/FormField.vue";
import PatientLookup from "../components/patient/PatientLookup.vue";

import {
  apiGet,
  apiPost,
} from "../services/api";

import {
  useEHR,
} from "../stores/ehr";

type DentalRecord = {
  dental_record_id: number;
  record_date: string | null;
  tooth_number: string | null;
  condition: string | null;
  treatment: string | null;
  filling_type: string | null;
  crown_present: boolean | null;
  implant_present: boolean | null;
  missing_tooth: boolean | null;
  notes: string | null;
  recorded_by_name: string | null;
};

const {
  patients,
} = useEHR();

const selected = ref<any>(null);
const records = ref<DentalRecord[]>([]);
const formOpen = ref(false);
const loadingHistory = ref(false);
const saving = ref(false);
const message = ref("");
const messageType = ref<"success" | "error">("success");

const form = reactive({
  recordDate: defaultDate(),
  toothNumber: "",
  condition: "",
  treatment: "",
  fillingType: "",
  crownPresent: false,
  implantPresent: false,
  missingTooth: false,
  notes: "",
});

const patientAge = computed(() => {
  if (!selected.value?.dateOfBirth) {
    return null;
  }

  const date = new Date(selected.value.dateOfBirth);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Math.floor((Date.now() - date.getTime()) / 31557600000);
});

watch(
  () => selected.value?.id,
  () => {
    void loadHistory();
  },
  { immediate: true },
);

function defaultDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;

  return new Date(now.getTime() - offset)
    .toISOString()
    .slice(0, 10);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Date not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-LK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function yesNo(value: boolean | null): string {
  return value ? "Yes" : "No";
}

function clearMessage() {
  message.value = "";
}

function openForm() {
  clearMessage();
  formOpen.value = true;
}

function closeForm() {
  if (!saving.value) {
    formOpen.value = false;
  }
}

function resetForm() {
  Object.assign(form, {
    recordDate: defaultDate(),
    toothNumber: "",
    condition: "",
    treatment: "",
    fillingType: "",
    crownPresent: false,
    implantPresent: false,
    missingTooth: false,
    notes: "",
  });
}

async function loadHistory() {
  if (!selected.value?.id) {
    records.value = [];
    return;
  }

  loadingHistory.value = true;
  clearMessage();

  try {
    const response = await apiGet<{
      data?: DentalRecord[];
    }>(`/dental-records/patient/${selected.value.id}`);

    records.value = Array.isArray(response?.data)
      ? response.data
      : [];
  } catch (error) {
    records.value = [];
    messageType.value = "error";
    message.value = error instanceof Error
      ? error.message
      : "Unable to load the dental consultation history.";
  } finally {
    loadingHistory.value = false;
  }
}

async function save() {
  if (!selected.value?.id) {
    return;
  }

  clearMessage();
  saving.value = true;

  try {
    await apiPost("/dental-records", {
      patientId: Number(selected.value.id),
      recordDate: form.recordDate,
      toothNumber: form.toothNumber.trim(),
      condition: form.condition.trim(),
      treatment: form.treatment.trim(),
      fillingType: form.fillingType.trim() || null,
      crownPresent: form.crownPresent,
      implantPresent: form.implantPresent,
      missingTooth: form.missingTooth,
      notes: form.notes.trim() || null,
    });

    formOpen.value = false;
    resetForm();
    messageType.value = "success";
    message.value = "Dental consultation saved to the patient's EHR.";
    await loadHistory();
  } catch (error) {
    messageType.value = "error";
    message.value = error instanceof Error
      ? error.message
      : "Unable to save the dental consultation.";
  } finally {
    saving.value = false;
  }
}
</script>
