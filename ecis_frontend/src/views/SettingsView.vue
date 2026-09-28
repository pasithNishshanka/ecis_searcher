<template>
  <div>
    <PageHeader
      eyebrow="Authenticated user"
      title="Hospital context"
      description="Your hospital, role, and permissions are provided by the backend. They are not stored as clinical data in the frontend."
    >
      <span class="badge bg-teal-50 text-teal-700">{{ context?.role || "Loading role" }}</span>
    </PageHeader>

    <div v-if="error" class="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {{ error }}
    </div>
    <div v-if="success" class="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
      {{ success }}
    </div>

    <div class="grid gap-5 lg:grid-cols-2">
      <section class="card p-5">
        <h2 class="section-title">Current clinical context</h2>

        <div v-if="loading" class="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-400">
          Loading your authorized hospital assignments...
        </div>

        <div v-else-if="context" class="mt-5 space-y-4">
          <div class="rounded-xl bg-teal-50 p-4">
            <p class="text-xs font-black uppercase tracking-wider text-teal-700">Signed-in user</p>
            <p class="mt-1 font-black text-teal-950">{{ context.fullName }}</p>
            <p class="text-xs text-teal-800">{{ context.employeeNumber || context.username }}</p>
          </div>

          <div>
            <label for="hospital-context" class="label">Working hospital</label>
            <select
              id="hospital-context"
              v-model.number="selectedHospitalId"
              class="field mt-1"
              :disabled="switching || context.hospitalAssignments.length < 2"
            >
              <option v-for="assignment in context.hospitalAssignments" :key="assignment.assignmentId" :value="assignment.hospitalId">
                {{ assignment.hospitalName }} · {{ assignment.role }}
              </option>
            </select>
            <p class="mt-2 text-xs text-slate-500">
              A hospital switch replaces the access token and reloads clinical data for the selected authorized hospital.
            </p>
            <p v-if="context.hospitalAssignments.length < 2" class="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              Switching is unavailable because this user has only one active hospital assignment. A system administrator must add another authorized assignment first.
            </p>
          </div>

          <dl class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-xl bg-slate-50 p-3">
              <dt class="label">Role</dt>
              <dd class="mt-1 text-sm font-bold text-slate-800">{{ selectedAssignment?.role || context.role }}</dd>
            </div>
            <div class="rounded-xl bg-slate-50 p-3">
              <dt class="label">Department</dt>
              <dd class="mt-1 text-sm font-bold text-slate-800">{{ selectedAssignment?.department || context.department || "Not assigned" }}</dd>
            </div>
          </dl>

          <BaseButton :disabled="!canSwitch" :loading="switching" @click="switchHospital">
            Switch hospital
          </BaseButton>
        </div>

        <div v-else class="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
          Your authenticated hospital context could not be loaded.
        </div>
      </section>

      <section class="card p-5">
        <h2 class="section-title">Access model</h2>
        <div class="mt-4 space-y-3 text-sm leading-6 text-slate-600">
          <p>Each clinical request is authorized by the backend using the signed-in user, active hospital assignment, and role.</p>
          <p>Patient and clinical records remain in PostgreSQL. Browser state only holds the current authenticated session and never acts as the clinical source of truth.</p>
          <p>Hospital switching is available only for assignments created by an authorized administrator.</p>
        </div>
      </section>
    </div>

    <section v-if="context && !canManageAssignments" class="card mt-5 p-5">
      <h2 class="section-title">Need access to another hospital?</h2>
      <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
        Ask a system administrator or hospital administrator to add an authorized assignment for your existing staff account. Doctors and other clinical users cannot create their own access, so the hospital boundary remains protected.
      </p>
    </section>

    <section v-if="canManageAssignments" class="card mt-5 p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="section-title">Hospital and staff administration</h2>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Add authorized staff assignments from the database. Hospital administrators can manage their current hospital; system administrators can manage every active hospital and create new hospital records.
          </p>
        </div>
        <span class="badge bg-violet-50 text-violet-700">{{ context?.role }} access</span>
      </div>

      <div v-if="adminLoading" class="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
        Loading hospitals...
      </div>

      <div v-else class="mt-5 space-y-6">
        <form class="rounded-xl border border-teal-200 bg-teal-50/40 p-4" @submit.prevent="createStaffAccount">
          <h3 class="font-bold text-slate-900">Create staff login and credentials</h3>
          <p class="mt-1 text-xs leading-5 text-slate-500">
            This creates an active staff account and its first hospital assignment together. Give the initial password privately to the clinician.
          </p>

          <div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label class="label">
              Hospital
              <select v-model.number="staffAccountForm.hospitalId" class="field mt-1" :disabled="isHospitalAdministrator">
                <option :value="null">Select hospital</option>
                <option v-for="hospital in hospitals" :key="hospital.hospitalId" :value="hospital.hospitalId">{{ hospital.hospitalName }}</option>
              </select>
            </label>
            <label class="label">
              Staff role
              <select v-model="staffAccountForm.role" class="field mt-1">
                <option v-for="role in assignmentRoles" :key="role" :value="role">{{ role.replaceAll("_", " ") }}</option>
              </select>
            </label>
            <label class="label">
              Employee number
              <input v-model.trim="staffAccountForm.employeeNumber" class="field mt-1" placeholder="e.g. DOC-102" required>
            </label>
            <label class="label">
              Full name
              <input v-model.trim="staffAccountForm.fullName" class="field mt-1" placeholder="Clinician's full name" required>
            </label>
            <label class="label">
              Username
              <input v-model.trim="staffAccountForm.username" class="field mt-1" autocomplete="off" placeholder="e.g. doctor.perera" required>
            </label>
            <label class="label">
              Initial password
              <input v-model="staffAccountForm.password" class="field mt-1" type="password" autocomplete="new-password" minlength="12" placeholder="At least 12 characters" required>
            </label>
            <label class="label">
              Department
              <input v-model.trim="staffAccountForm.department" class="field mt-1" placeholder="e.g. OPD">
            </label>
            <label class="label">
              Designation
              <input v-model.trim="staffAccountForm.designation" class="field mt-1" placeholder="e.g. Medical Officer">
            </label>
            <label class="label">
              Professional license
              <input v-model.trim="staffAccountForm.licenseNumber" class="field mt-1" placeholder="Optional">
            </label>
            <label class="label">
              Phone
              <input v-model.trim="staffAccountForm.phone" class="field mt-1" placeholder="Optional">
            </label>
            <label class="label sm:col-span-2">
              Email
              <input v-model.trim="staffAccountForm.email" class="field mt-1" type="email" placeholder="Optional">
            </label>
          </div>

          <BaseButton class="mt-5" type="submit" :loading="staffAccountSaving" :disabled="!staffAccountForm.hospitalId || !staffAccountForm.employeeNumber || !staffAccountForm.fullName || !staffAccountForm.username || staffAccountForm.password.length < 12">
            Create staff login
          </BaseButton>
        </form>

        <div class="grid gap-6 xl:grid-cols-2">
        <form class="rounded-xl border border-slate-200 p-4" @submit.prevent="searchStaff">
          <h3 class="font-bold text-slate-900">1. Find an existing staff account</h3>
          <p class="mt-1 text-xs leading-5 text-slate-500">Search by employee number, full name, or username. Passwords and clinical information are never shown here.</p>

          <label for="staff-search" class="label mt-4">Staff search</label>
          <div class="mt-1 flex gap-2">
            <input id="staff-search" v-model.trim="staffQuery" class="field min-w-0 flex-1" placeholder="e.g. Perera or EMP-102">
            <BaseButton type="submit" :loading="staffSearching" :disabled="staffQuery.length < 2">Search</BaseButton>
          </div>

          <div v-if="staffResults.length" class="mt-4 max-h-72 space-y-2 overflow-y-auto">
            <button
              v-for="staff in staffResults"
              :key="staff.userId"
              type="button"
              class="w-full rounded-lg border p-3 text-left transition"
              :class="selectedStaff?.userId === staff.userId ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-slate-300'"
              @click="selectStaff(staff)"
            >
              <span class="block font-bold text-slate-900">{{ staff.fullName }}</span>
              <span class="mt-1 block text-xs text-slate-500">{{ staff.employeeNumber || staff.username }} · Current account role: {{ staff.accountRole }}</span>
              <span class="block text-xs text-slate-500">Home hospital: {{ staff.homeHospitalName }}</span>
            </button>
          </div>
          <p v-else-if="staffSearchFinished" class="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">No active staff account matched that search.</p>
        </form>

        <form class="rounded-xl border border-slate-200 p-4" @submit.prevent="saveAssignment">
          <h3 class="font-bold text-slate-900">2. Add hospital assignment</h3>
          <p class="mt-1 text-xs leading-5 text-slate-500">{{ selectedStaff ? `Selected: ${selectedStaff.fullName}` : "Select a staff account before saving an assignment." }}</p>

          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <label class="label">
              Hospital
              <select v-model.number="assignmentForm.hospitalId" class="field mt-1" :disabled="isHospitalAdministrator">
                <option :value="null">Select hospital</option>
                <option v-for="hospital in hospitals" :key="hospital.hospitalId" :value="hospital.hospitalId">{{ hospital.hospitalName }}</option>
              </select>
            </label>
            <label class="label">
              Assignment role
              <select v-model="assignmentForm.role" class="field mt-1">
                <option v-for="role in assignmentRoles" :key="role" :value="role">{{ role.replaceAll("_", " ") }}</option>
              </select>
            </label>
            <label class="label">
              Department
              <input v-model.trim="assignmentForm.department" class="field mt-1" placeholder="e.g. OPD">
            </label>
            <label class="label">
              Designation
              <input v-model.trim="assignmentForm.designation" class="field mt-1" placeholder="e.g. Medical Officer">
            </label>
            <label class="label">
              Professional license
              <input v-model.trim="assignmentForm.licenseNumber" class="field mt-1" placeholder="Optional">
            </label>
            <label class="label">
              Start date
              <input v-model="assignmentForm.startDate" class="field mt-1" type="date">
            </label>
          </div>

          <BaseButton class="mt-5" type="submit" :loading="assignmentSaving" :disabled="!selectedStaff || !assignmentForm.hospitalId || !assignmentForm.role">
            Save assignment
          </BaseButton>
        </form>
        </div>
      </div>

      <form v-if="canCreateHospitals" class="mt-6 rounded-xl border border-violet-200 bg-violet-50/40 p-4" @submit.prevent="createHospital">
        <h3 class="font-bold text-slate-900">Create hospital</h3>
        <p class="mt-1 text-xs leading-5 text-slate-500">Create a real hospital record before assigning any staff to it. Hospital code and name must be unique.</p>

        <div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label class="label">
            Hospital code
            <input v-model.trim="hospitalForm.hospitalCode" class="field mt-1" placeholder="e.g. KDH" required>
          </label>
          <label class="label">
            Hospital name
            <input v-model.trim="hospitalForm.hospitalName" class="field mt-1" placeholder="Official hospital name" required>
          </label>
          <label class="label">
            Type
            <input v-model.trim="hospitalForm.hospitalType" class="field mt-1" placeholder="Base Hospital">
          </label>
          <label class="label">
            Province
            <input v-model.trim="hospitalForm.province" class="field mt-1" placeholder="Western Province">
          </label>
          <label class="label">
            District
            <input v-model.trim="hospitalForm.district" class="field mt-1" placeholder="Colombo">
          </label>
          <label class="label">
            Phone
            <input v-model.trim="hospitalForm.phone" class="field mt-1" placeholder="011 123 4567">
          </label>
          <label class="label">
            Email
            <input v-model.trim="hospitalForm.email" class="field mt-1" type="email" placeholder="hospital@example.lk">
          </label>
          <label class="label sm:col-span-2 xl:col-span-1">
            Address
            <input v-model.trim="hospitalForm.address" class="field mt-1" placeholder="Official address">
          </label>
        </div>

        <BaseButton class="mt-5" type="submit" :loading="hospitalSaving" :disabled="!hospitalForm.hospitalCode || !hospitalForm.hospitalName">
          Create hospital
        </BaseButton>
      </form>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import PageHeader from "../components/PageHeader.vue";
import BaseButton from "../components/ui/BaseButton.vue";
import { apiGet, apiPost, switchHospitalContext } from "../services/api";

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

type Hospital = {
  hospitalId: number;
  hospitalCode: string;
  hospitalName: string;
  hospitalType: string | null;
  province: string | null;
  district: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
};

type Staff = {
  userId: number;
  employeeNumber: string | null;
  fullName: string;
  username: string;
  accountRole: string;
  accountDepartment: string | null;
  homeHospitalId: number;
  homeHospitalName: string;
};

type DataResponse<T> = { data?: T };

const assignmentRoles = ["ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "NURSE", "SURGEON", "RADIOLOGIST", "LAB_TECHNICIAN", "PHARMACIST", "RECEPTIONIST", "ECIS_SEARCHER"];
const today = new Date().toISOString().slice(0, 10);
const context = ref<UserContext | null>(null);
const selectedHospitalId = ref<number | null>(null);
const loading = ref(true);
const switching = ref(false);
const error = ref("");
const success = ref("");
const adminLoading = ref(false);
const hospitals = ref<Hospital[]>([]);
const staffQuery = ref("");
const staffResults = ref<Staff[]>([]);
const staffSearching = ref(false);
const staffSearchFinished = ref(false);
const selectedStaff = ref<Staff | null>(null);
const assignmentSaving = ref(false);
const hospitalSaving = ref(false);
const staffAccountSaving = ref(false);

const assignmentForm = ref({
  hospitalId: null as number | null,
  role: "DOCTOR",
  department: "",
  designation: "",
  licenseNumber: "",
  startDate: today,
});

const hospitalForm = ref({
  hospitalCode: "",
  hospitalName: "",
  hospitalType: "",
  province: "",
  district: "",
  address: "",
  phone: "",
  email: "",
});

const staffAccountForm = ref({
  hospitalId: null as number | null,
  role: "DOCTOR",
  employeeNumber: "",
  fullName: "",
  username: "",
  password: "",
  department: "",
  designation: "",
  licenseNumber: "",
  phone: "",
  email: "",
});

const selectedAssignment = computed(() => context.value?.hospitalAssignments.find(
  (assignment) => assignment.hospitalId === selectedHospitalId.value,
) || null);
const normalizedRole = computed(() => String(context.value?.role || "").trim().toUpperCase());
const canManageAssignments = computed(() => ["SYSTEM_ADMIN", "ADMIN", "HOSPITAL_ADMIN"].includes(normalizedRole.value));
const canCreateHospitals = computed(() => normalizedRole.value === "SYSTEM_ADMIN");
const isHospitalAdministrator = computed(() => ["ADMIN", "HOSPITAL_ADMIN"].includes(normalizedRole.value));
const canSwitch = computed(() => selectedHospitalId.value !== null && selectedHospitalId.value !== context.value?.hospitalId && !switching.value);

function messageFrom(errorValue: unknown, fallback: string) {
  return errorValue instanceof Error ? errorValue.message : fallback;
}

function clearFeedback() {
  error.value = "";
  success.value = "";
}

async function loadContext() {
  loading.value = true;
  error.value = "";
  try {
    const response = await apiGet<DataResponse<UserContext>>("/auth/context");
    context.value = response?.data || null;
    selectedHospitalId.value = context.value?.hospitalId || null;
    assignmentForm.value.hospitalId = context.value?.hospitalId || null;
    staffAccountForm.value.hospitalId = context.value?.hospitalId || null;
    if (canManageAssignments.value) {
      await loadAdministration();
    }
  } catch (loadError) {
    error.value = messageFrom(loadError, "Unable to load the authenticated hospital context.");
  } finally {
    loading.value = false;
  }
}

async function loadAdministration() {
  if (!canManageAssignments.value) return;
  adminLoading.value = true;
  try {
    const response = await apiGet<DataResponse<Hospital[]>>("/administration/hospitals");
    hospitals.value = (response.data || []).filter((hospital) => hospital.isActive);
  } catch (loadError) {
    error.value = messageFrom(loadError, "Unable to load hospitals for administration.");
  } finally {
    adminLoading.value = false;
  }
}

async function switchHospital() {
  if (!canSwitch.value || selectedHospitalId.value === null) return;
  switching.value = true;
  clearFeedback();
  try {
    await switchHospitalContext(selectedHospitalId.value);
    window.location.assign("/dashboard");
  } catch (switchError) {
    error.value = messageFrom(switchError, "Unable to switch hospital context.");
  } finally {
    switching.value = false;
  }
}

async function searchStaff() {
  if (staffQuery.value.length < 2) return;
  staffSearching.value = true;
  staffSearchFinished.value = false;
  clearFeedback();
  try {
    const response = await apiGet<DataResponse<Staff[]>>(`/administration/users?q=${encodeURIComponent(staffQuery.value)}`);
    staffResults.value = response.data || [];
    staffSearchFinished.value = true;
  } catch (searchError) {
    staffResults.value = [];
    error.value = messageFrom(searchError, "Unable to search staff accounts.");
  } finally {
    staffSearching.value = false;
  }
}

async function createStaffAccount() {
  if (!staffAccountForm.value.hospitalId || staffAccountForm.value.password.length < 12) return;
  staffAccountSaving.value = true;
  clearFeedback();
  try {
    const response = await apiPost<DataResponse<Staff>>(
      "/administration/users",
      staffAccountForm.value,
    );
    const staff = response.data;
    if (staff) {
      selectedStaff.value = staff;
      staffResults.value = [staff];
      assignmentForm.value.hospitalId = staff.homeHospitalId;
      assignmentForm.value.role = staff.accountRole;
      assignmentForm.value.department = staff.accountDepartment || "";
      success.value = `Created login for ${staff.fullName}. The clinician can now sign in with the credentials you provided.`;
    } else {
      success.value = "Staff login created.";
    }
    staffAccountForm.value = {
      hospitalId: context.value?.hospitalId || null,
      role: "DOCTOR",
      employeeNumber: "",
      fullName: "",
      username: "",
      password: "",
      department: "",
      designation: "",
      licenseNumber: "",
      phone: "",
      email: "",
    };
  } catch (createError) {
    error.value = messageFrom(createError, "Unable to create the staff login.");
  } finally {
    staffAccountSaving.value = false;
  }
}

function selectStaff(staff: Staff) {
  selectedStaff.value = staff;
  assignmentForm.value.department = staff.accountDepartment || "";
}

async function saveAssignment() {
  if (!selectedStaff.value || !assignmentForm.value.hospitalId) return;
  assignmentSaving.value = true;
  clearFeedback();
  try {
    await apiPost("/administration/assignments", {
      userId: selectedStaff.value.userId,
      hospitalId: assignmentForm.value.hospitalId,
      role: assignmentForm.value.role,
      department: assignmentForm.value.department || null,
      designation: assignmentForm.value.designation || null,
      licenseNumber: assignmentForm.value.licenseNumber || null,
      startDate: assignmentForm.value.startDate,
    });
    success.value = `${selectedStaff.value.fullName} now has an active ${assignmentForm.value.role.replaceAll("_", " ")} assignment.`;
    if (selectedStaff.value.userId === context.value?.userId) await loadContext();
  } catch (saveError) {
    error.value = messageFrom(saveError, "Unable to save the hospital assignment.");
  } finally {
    assignmentSaving.value = false;
  }
}

async function createHospital() {
  if (!canCreateHospitals.value) return;
  hospitalSaving.value = true;
  clearFeedback();
  try {
    const response = await apiPost<DataResponse<Hospital>>("/administration/hospitals", hospitalForm.value);
    const hospital = response.data;
    success.value = hospital ? `${hospital.hospitalName} was created. You can now assign authorized staff to it.` : "Hospital created. You can now assign authorized staff to it.";
    hospitalForm.value = { hospitalCode: "", hospitalName: "", hospitalType: "", province: "", district: "", address: "", phone: "", email: "" };
    await loadAdministration();
    if (hospital) assignmentForm.value.hospitalId = hospital.hospitalId;
  } catch (createError) {
    error.value = messageFrom(createError, "Unable to create the hospital.");
  } finally {
    hospitalSaving.value = false;
  }
}

onMounted(() => { void loadContext(); });
</script>
