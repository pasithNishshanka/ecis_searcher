<template>
  <div>
    <PageHeader
      eyebrow="Authenticated user"
      title="Hospital context"
      description="Your hospital, role, and permissions are provided by the backend. They are not stored as clinical data in the frontend."
    >
      <span class="badge bg-teal-50 text-teal-700">
        {{ context?.role || "Loading role" }}
      </span>
    </PageHeader>

    <div
      v-if="error"
      class="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      {{ error }}
    </div>

    <div class="grid gap-5 lg:grid-cols-2">
      <section class="card p-5">
        <h2 class="section-title">
          Current clinical context
        </h2>

        <div
          v-if="loading"
          class="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-400"
        >
          Loading your authorized hospital assignments...
        </div>

        <div
          v-else-if="context"
          class="mt-5 space-y-4"
        >
          <div class="rounded-xl bg-teal-50 p-4">
            <p class="text-xs font-black uppercase tracking-wider text-teal-700">
              Signed-in user
            </p>

            <p class="mt-1 font-black text-teal-950">
              {{ context.fullName }}
            </p>

            <p class="text-xs text-teal-800">
              {{ context.employeeNumber || context.username }}
            </p>
          </div>

          <div>
            <label
              for="hospital-context"
              class="label"
            >
              Working hospital
            </label>

            <select
              id="hospital-context"
              v-model.number="selectedHospitalId"
              class="field mt-1"
              :disabled="switching || context.hospitalAssignments.length < 2"
            >
              <option
                v-for="assignment in context.hospitalAssignments"
                :key="assignment.assignmentId"
                :value="assignment.hospitalId"
              >
                {{ assignment.hospitalName }} · {{ assignment.role }}
              </option>
            </select>

            <p class="mt-2 text-xs text-slate-500">
              A hospital switch replaces the access token and reloads clinical data for the selected authorized hospital.
            </p>

            <p
              v-if="context.hospitalAssignments.length < 2"
              class="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800"
            >
              Switching is unavailable because this user has only one active hospital assignment. A system administrator must add another authorized assignment first.
            </p>
          </div>

          <dl class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-xl bg-slate-50 p-3">
              <dt class="label">Role</dt>
              <dd class="mt-1 text-sm font-bold text-slate-800">
                {{ selectedAssignment?.role || context.role }}
              </dd>
            </div>

            <div class="rounded-xl bg-slate-50 p-3">
              <dt class="label">Department</dt>
              <dd class="mt-1 text-sm font-bold text-slate-800">
                {{ selectedAssignment?.department || context.department || "Not assigned" }}
              </dd>
            </div>
          </dl>

          <BaseButton
            :disabled="!canSwitch"
            :loading="switching"
            @click="switchHospital"
          >
            Switch hospital
          </BaseButton>
        </div>

        <div
          v-else
          class="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500"
        >
          Your authenticated hospital context could not be loaded.
        </div>
      </section>

      <section class="card p-5">
        <h2 class="section-title">
          Access model
        </h2>

        <div class="mt-4 space-y-3 text-sm leading-6 text-slate-600">
          <p>
            Each clinical request is authorized by the backend using the signed-in user, active hospital assignment, and role.
          </p>

          <p>
            Patient and clinical records remain in PostgreSQL. Browser state only holds the current authenticated session and never acts as the clinical source of truth.
          </p>

          <p>
            Hospital switching is available only for assignments created by an authorized administrator.
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
} from "vue";

import PageHeader from "../components/PageHeader.vue";
import BaseButton from "../components/ui/BaseButton.vue";

import {
  apiGet,
  switchHospitalContext,
} from "../services/api";

type HospitalAssignment = {
  assignmentId: number;
  hospitalId: number;
  hospitalName: string;
  role: string;
  department: string | null;
  designation: string | null;
  licenseNumber: string | null;
};

type UserContext = {
  userId: number;
  hospitalId: number;
  hospitalName: string;
  assignmentId: number;
  employeeNumber: string | null;
  fullName: string;
  username: string;
  role: string;
  department: string | null;
  hospitalAssignments: HospitalAssignment[];
};

const context = ref<UserContext | null>(null);
const selectedHospitalId = ref<number | null>(null);
const loading = ref(true);
const switching = ref(false);
const error = ref("");

const selectedAssignment = computed(() =>
  context.value?.hospitalAssignments.find(
    (assignment) => assignment.hospitalId === selectedHospitalId.value,
  ) || null,
);

const canSwitch = computed(() =>
  selectedHospitalId.value !== null &&
  selectedHospitalId.value !== context.value?.hospitalId &&
  !switching.value,
);

async function loadContext() {
  loading.value = true;
  error.value = "";

  try {
    const response = await apiGet<{ data?: UserContext }>("/auth/context");
    context.value = response?.data || null;
    selectedHospitalId.value = context.value?.hospitalId || null;
  } catch (loadError) {
    error.value = loadError instanceof Error
      ? loadError.message
      : "Unable to load the authenticated hospital context.";
  } finally {
    loading.value = false;
  }
}

async function switchHospital() {
  if (!canSwitch.value || selectedHospitalId.value === null) {
    return;
  }

  switching.value = true;
  error.value = "";

  try {
    await switchHospitalContext(selectedHospitalId.value);
    window.location.assign("/dashboard");
  } catch (switchError) {
    error.value = switchError instanceof Error
      ? switchError.message
      : "Unable to switch hospital context.";
  } finally {
    switching.value = false;
  }
}

onMounted(() => {
  void loadContext();
});
</script>
