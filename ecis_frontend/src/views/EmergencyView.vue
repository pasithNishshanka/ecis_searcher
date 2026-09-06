<template>
  <div>
    <PageHeader
      eyebrow="Emergency department"
      title="Emergency cases"
      description="An unidentified patient can enter the emergency workflow without creating a second identity record."
    >
      <BaseButton @click="open = true">
        <template #icon>
          <Plus :size="16" />
        </template>
        New emergency case
      </BaseButton>
    </PageHeader>

    <!-- Error -->
    <div
      v-if="error"
      class="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      {{ error }}
    </div>

    <!-- Statistics -->
    <div class="grid gap-4 sm:grid-cols-3">
      <StatCard
        label="Active cases"
        :value="emergencies.length"
      />

      <StatCard
        label="Unidentified"
        :value="unidentified"
      />

      <StatCard
        label="Identified/admitted"
        :value="emergencies.length - unidentified"
      />
    </div>

    <!-- Loading -->
    <div
      v-if="loading"
      class="card mt-6 p-12 text-center"
    >
      <p class="text-lg font-bold">
        Loading emergency cases...
      </p>

      <p class="mt-1 text-sm text-slate-400">
        Fetching emergency records from the hospital EHR.
      </p>
    </div>

    <!-- Emergency Cases -->
    <div
      v-else
      class="mt-6 space-y-3"
    >
      <div
        v-for="e in emergencies"
        :key="e.emergency_case_id"
        class="card p-5"
      >
        <div
          class="flex flex-col justify-between gap-3 sm:flex-row"
        >
          <div>
            <b>
              {{ e.case_number }}
              ·
              {{ emergencyDescription(e) }}
            </b>

            <p class="mt-1 text-xs text-slate-400">
              {{ formatDate(e.arrival_date) }}
              ·
              {{ emergencyDepartment(e) }}
            </p>

            <p
              v-if="e.temporary_identity_reference"
              class="mt-1 text-xs text-slate-400"
            >
              Temporary reference:
              {{ e.temporary_identity_reference }}
            </p>

            <p
              v-if="e.patient_number"
              class="mt-1 text-xs text-slate-400"
            >
              Patient:
              {{ e.patient_number }}
              <span v-if="e.patient_name">
                · {{ e.patient_name }}
              </span>
            </p>
          </div>

          <div class="flex items-center gap-2">
            <StatusBadge
              :label="e.status"
              :tone="
                e.unidentified_patient
                  ? 'warning'
                  : e.status === 'IDENTIFIED'
                    ? 'success'
                    : 'info'
              "
            />

            <RouterLink
              v-if="e.unidentified_patient"
              :to="`/ecis?emergencyCaseId=${e.emergency_case_id}`"
            >
              <BaseButton
                variant="secondary"
                size="sm"
              >
                Search ECIS
              </BaseButton>
            </RouterLink>
          </div>
        </div>
      </div>

      <!-- Empty -->
      <div
        v-if="!emergencies.length"
        class="card p-12 text-center"
      >
        <p class="text-lg font-bold">
          No emergency cases found
        </p>

        <p class="mt-1 text-sm text-slate-400">
          Create an emergency case to begin.
        </p>
      </div>
    </div>

    <!-- Create Emergency Modal -->
    <Modal
      :open="open"
      title="New emergency case"
      description="Patient ID is optional until identity is established."
      @close="open = false"
    >
      <form
        @submit.prevent="save"
        class="grid gap-4 sm:grid-cols-2"
      >
        <div class="sm:col-span-2">
          <FormField
            label="Clinical description"
            required
          >
            <BaseInput
              v-model="f.chiefComplaint"
              placeholder="Road traffic accident"
              required
            />
          </FormField>
        </div>

        <FormField label="Initial condition">
          <BaseInput
            v-model="f.initialCondition"
            placeholder="Unidentified trauma patient"
          />
        </FormField>

        <FormField label="Arrival mode">
          <BaseSelect v-model="f.arrivalMode">
            <option value="WALK_IN">
              Walk-in
            </option>

            <option value="AMBULANCE">
              Ambulance
            </option>

            <option value="POLICE">
              Police
            </option>

            <option value="TRANSFER">
              Transfer
            </option>
          </BaseSelect>
        </FormField>

        <FormField label="Triage level">
          <BaseInput
            v-model="f.triageLevel"
            placeholder="RED / ORANGE / YELLOW / GREEN"
          />
        </FormField>

        <FormField label="Status">
          <BaseSelect v-model="f.status">
            <option value="IDENTIFICATION_PENDING">
              Identification pending
            </option>

            <option value="IN_TREATMENT">
              In treatment
            </option>
          </BaseSelect>
        </FormField>

        <div class="sm:col-span-2">
          <FormField label="Known patient (optional)">
            <BaseSelect v-model="f.patientId">
              <option value="">
                Unknown
              </option>

              <option
                v-for="p in patients"
                :key="p.patient_id"
                :value="p.patient_id"
              >
                {{ p.patient_number }}
                —
                {{ p.first_name }}
                {{ p.last_name }}
              </option>
            </BaseSelect>
          </FormField>
        </div>

        <div
          v-if="!f.patientId"
          class="sm:col-span-2"
        >
          <FormField
            label="Temporary identity reference"
            required
          >
            <BaseInput
              v-model="f.temporaryIdentityReference"
              placeholder="TEMP-EMG-005"
              required
            />
          </FormField>
        </div>

        <div class="sm:col-span-2 flex justify-end">
          <BaseButton
            type="submit"
            :disabled="saving"
          >
            {{
              saving
                ? "Creating..."
                : "Create emergency case"
            }}
          </BaseButton>
        </div>
      </form>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onMounted,
  reactive,
  ref,
} from "vue";

import { RouterLink } from "vue-router";
import { Plus } from "lucide-vue-next";

import PageHeader from "../components/PageHeader.vue";
import StatCard from "../components/StatCard.vue";
import Modal from "../components/Modal.vue";

import BaseButton from "../components/ui/BaseButton.vue";
import BaseInput from "../components/ui/BaseInput.vue";
import BaseSelect from "../components/ui/BaseSelect.vue";
import StatusBadge from "../components/ui/StatusBadge.vue";

import FormField from "../components/forms/FormField.vue";

import {
  apiGet,
  apiPost,
} from "../services/api";

interface EmergencyCase {
  emergency_case_id: number;
  case_number: string;
  arrival_date: string;
  arrival_mode?: string | null;
  triage_level?: string | null;
  chief_complaint?: string | null;
  initial_condition?: string | null;
  unidentified_patient: boolean;
  temporary_identity_reference?: string | null;
  status: string;
  patient_id?: number | null;
  patient_number?: string | null;
  patient_name?: string | null;
  hospital_id?: number;
  hospital_name?: string;
  assigned_doctor_id?: number | null;
  assigned_doctor_name?: string | null;
}

interface Patient {
  patient_id: number;
  patient_number: string;
  first_name: string;
  last_name: string;
}

const emergencies = ref<EmergencyCase[]>([]);
const patients = ref<Patient[]>([]);

const loading = ref(false);
const saving = ref(false);
const error = ref("");

const open = ref(false);

const unidentified = computed(() =>
  emergencies.value.filter(
    (e) => e.unidentified_patient
  ).length
);

const f = reactive({
  chiefComplaint: "",
  initialCondition: "",
  arrivalMode: "WALK_IN",
  triageLevel: "",
  status: "IDENTIFICATION_PENDING",
  patientId: "",
  temporaryIdentityReference: "",
});

async function loadEmergencies() {
  loading.value = true;
  error.value = "";

  try {
    const response = await apiGet<{
      success: boolean;
      count: number;
      data: EmergencyCase[];
    }>("/emergency");

    emergencies.value = response.data || [];
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "Failed to load emergency cases.";

    emergencies.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadPatients() {
  try {
    const response = await apiGet<{
      success: boolean;
      data: Patient[];
    }>("/patients");

    patients.value = response.data || [];
  } catch {
    patients.value = [];
  }
}

async function save() {
  error.value = "";
  saving.value = true;

  try {
    const isUnidentified = !f.patientId;

    const payload = {
      patientId: isUnidentified
        ? null
        : Number(f.patientId),

      caseNumber:
        f.temporaryIdentityReference ||
        `EMG-${Date.now()}`,

      arrivalDate: new Date().toISOString(),

      arrivalMode: f.arrivalMode,

      triageLevel:
        f.triageLevel || null,

      chiefComplaint:
        f.chiefComplaint,

      initialCondition:
        f.initialCondition || null,

      unidentifiedPatient:
        isUnidentified,

      temporaryIdentityReference:
        isUnidentified
          ? f.temporaryIdentityReference
          : null,
    };

    await apiPost("/emergency", {
      ...payload,

      // Backend requires hospitalId.
      // Backend authentication also determines
      // the permitted hospital.
      hospitalId: getHospitalId(),
    });

    open.value = false;

    resetForm();

    await loadEmergencies();
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "Failed to create emergency case.";
  } finally {
    saving.value = false;
  }
}

function getHospitalId(): number {
  const userRaw =
    localStorage.getItem("ecis-user");

  if (!userRaw) {
    throw new Error(
      "Authenticated hospital information is missing."
    );
  }

  const user = JSON.parse(userRaw);

  if (!user.hospitalId) {
    throw new Error(
      "Authenticated user's hospital is missing."
    );
  }

  return Number(user.hospitalId);
}

function resetForm() {
  Object.assign(f, {
    chiefComplaint: "",
    initialCondition: "",
    arrivalMode: "WALK_IN",
    triageLevel: "",
    status: "IDENTIFICATION_PENDING",
    patientId: "",
    temporaryIdentityReference: "",
  });
}

function emergencyDescription(
  e: EmergencyCase
) {
  return (
    e.chief_complaint ||
    e.initial_condition ||
    "Emergency case"
  );
}

function emergencyDepartment(
  e: EmergencyCase
) {
  return (
    e.arrival_mode ||
    "Emergency department"
  );
}

function formatDate(
  value: string
) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

onMounted(async () => {
  await Promise.all([
    loadEmergencies(),
    loadPatients(),
  ]);
});
</script>