<template>
  <div>
    <PageHeader
      eyebrow="Authenticated user"
      title="Hospital context"
      description="Manage your hospital assignment and staff access."
    >
      <span class="badge bg-teal-50 text-teal-700">{{ context?.role || "Loading role" }}</span>
      <span v-if="context?.allModuleAccess" class="badge bg-violet-50 text-violet-700">Full module access</span>
    </PageHeader>

    <div v-if="error" class="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {{ error }}
    </div>
    <div v-if="success" class="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
      {{ success }}
    </div>

    <div class="max-w-3xl">
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
            <p v-if="context.internalClinicianId" class="text-xs text-teal-800">Internal clinician ID: {{ context.internalClinicianId }}</p>
          </div>

          <div>
            <label for="hospital-context" class="label">Working hospital and role</label>
            <select
              id="hospital-context"
              v-model.number="selectedAssignmentId"
              class="field mt-1"
              :disabled="switching || context.hospitalAssignments.length < 2"
            >
              <option v-for="assignment in context.hospitalAssignments" :key="assignment.assignmentId" :value="assignment.assignmentId">
                {{ assignment.hospitalName }} · {{ assignment.role }}
              </option>
            </select>
            <p class="mt-2 text-xs text-slate-500">
              Switching applies the selected hospital and role to your current session.
            </p>
            <p v-if="context.hospitalAssignments.length < 2" class="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              No other hospital or role assignment is available for this account.
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
            Switch assignment
          </BaseButton>
        </div>

        <div v-else class="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
          Your authenticated hospital context could not be loaded.
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
              <select v-model="staffAccountForm.role" class="field mt-1" @change="onStaffRoleChange">
                <option v-for="role in assignmentRoles" :key="role" :value="role">{{ role.replaceAll("_", " ") }}</option>
                <option v-if="canCreateHospitals && selectedStaff?.userId === context?.userId" value="SYSTEM_ADMIN">System administrator</option>
              </select>
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
              <select v-model="staffAccountForm.department" class="field mt-1" required @change="onStaffDepartmentChange">
                <option value="">Select department</option>
                <option v-for="department in departmentOptions" :key="department" :value="department">{{ department }}</option>
              </select>
            </label>
            <label class="label">
              Designation
              <input v-model.trim="staffAccountForm.designation" class="field mt-1" placeholder="e.g. Medical Officer">
              <span class="mt-1 block text-xs font-normal text-slate-500">Suggested from the role and department. Confirm or edit the actual job title.</span>
            </label>
            <label class="label">
              Professional license
              <input v-model.trim="staffAccountForm.licenseNumber" class="field mt-1" placeholder="Enter the clinician's actual registration number">
              <span class="mt-1 block text-xs font-normal text-slate-500">An official registration number cannot be generated by ECIS. Enter it only after checking the clinician's registration.</span>
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

          <p v-if="staffRoleNotice" class="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{{ staffRoleNotice }}</p>

          <p class="mt-3 text-xs text-slate-500">The system assigns an employee number when the account is created. Enter a professional license only if it belongs to this staff member.</p>
          <p class="mt-1 text-xs text-slate-500">Clinical roles also receive an internal ECIS clinician ID on creation. This is not an official professional license.</p>
          <BaseButton class="mt-5" type="submit" :loading="staffAccountSaving" :disabled="!staffAccountForm.hospitalId || !staffAccountForm.department || !staffAccountForm.fullName || !staffAccountForm.username || staffAccountForm.password.length < 12">
            Create staff login
          </BaseButton>
          <div v-if="lastCreatedStaff" class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p class="font-bold">Created: {{ lastCreatedStaff.fullName }}</p>
            <p>Employee number: {{ lastCreatedStaff.employeeNumber }}</p>
            <p v-if="lastCreatedStaff.internalClinicianId">Internal clinician ID: {{ lastCreatedStaff.internalClinicianId }}</p>
            <p v-if="lastCreatedStaff.licenseNumber">Professional license on file: {{ lastCreatedStaff.licenseNumber }}</p>
          </div>
        </form>

        <div class="grid gap-6 xl:grid-cols-2">
        <form class="rounded-xl border border-slate-200 p-4" @submit.prevent="searchStaff">
          <h3 class="font-bold text-slate-900">1. Find an existing staff account</h3>
          <p class="mt-1 text-xs leading-5 text-slate-500">Search by employee number, internal clinician ID, full name, or username. Passwords and clinical information are never shown here.</p>

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
              <span v-if="staff.internalClinicianId" class="block text-xs text-slate-500">Internal clinician ID: {{ staff.internalClinicianId }}</span>
              <span class="block text-xs text-slate-500">Home hospital: {{ staff.homeHospitalName }}</span>
            </button>
          </div>
          <p v-else-if="staffSearchFinished" class="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">No active staff account matched that search.</p>
        </form>

        <form class="rounded-xl border border-slate-200 p-4" @submit.prevent="saveAssignment">
          <h3 class="font-bold text-slate-900">2. Add hospital assignment</h3>
          <p class="mt-1 text-xs leading-5 text-slate-500">{{ selectedStaff ? `Selected: ${selectedStaff.fullName}` : "Select a staff account before saving an assignment." }}</p>
          <p v-if="selectedStaff?.internalClinicianId" class="mt-1 text-xs text-slate-500">Internal clinician ID: {{ selectedStaff.internalClinicianId }}</p>

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
              <select v-model="assignmentForm.role" class="field mt-1" @change="onAssignmentRoleChange">
                <option v-for="role in assignmentRoles" :key="role" :value="role">{{ role.replaceAll("_", " ") }}</option>
              </select>
            </label>
            <label class="label">
              Department
              <select v-model="assignmentForm.department" class="field mt-1" @change="onAssignmentDepartmentChange">
                <option value="">Select department</option>
                <option v-if="assignmentForm.department && !departmentOptions.includes(assignmentForm.department)" :value="assignmentForm.department">{{ assignmentForm.department }} (existing)</option>
                <option v-for="department in departmentOptions" :key="department" :value="department">{{ department }}</option>
              </select>
            </label>
            <label class="label">
              Designation
              <input v-model.trim="assignmentForm.designation" class="field mt-1" placeholder="e.g. Medical Officer">
              <span class="mt-1 block text-xs font-normal text-slate-500">Suggested from the role and department. Confirm or edit the actual job title.</span>
            </label>
            <label class="label">
              Professional license
              <input v-model.trim="assignmentForm.licenseNumber" class="field mt-1" placeholder="Actual registration number, if known">
              <span class="mt-1 block text-xs font-normal text-slate-500">An existing number on file is filled when you select staff. ECIS does not issue professional licenses.</span>
            </label>
            <label class="label">
              Start date
              <input v-model="assignmentForm.startDate" class="field mt-1" type="date">
            </label>
          </div>

          <p v-if="assignmentRoleNotice" class="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{{ assignmentRoleNotice }}</p>

          <BaseButton class="mt-5" type="submit" :loading="assignmentSaving" :disabled="!selectedStaff || !assignmentForm.hospitalId || !assignmentForm.role">
            Save assignment
          </BaseButton>
        </form>
        </div>
      </div>

      <form v-if="canCreateHospitals" class="mt-6 rounded-xl border border-violet-200 bg-violet-50/40 p-4" @submit.prevent="createHospital">
        <h3 class="font-bold text-slate-900">Create hospital</h3>
        <p class="mt-1 text-xs leading-5 text-slate-500">Enter the hospital's official name. The system will generate its unique hospital code when you create it.</p>

        <div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            <select v-model="hospitalForm.province" class="field mt-1" required @change="hospitalForm.district = ''">
              <option value="">Select province</option>
              <option v-for="province in SRI_LANKAN_PROVINCES" :key="province" :value="province">{{ province }}</option>
            </select>
          </label>
          <label class="label">
            District
            <select v-model="hospitalForm.district" class="field mt-1" :disabled="!hospitalForm.province" required>
              <option value="">Select district</option>
              <option v-for="district in hospitalDistricts" :key="district" :value="district">{{ district }}</option>
            </select>
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

        <BaseButton class="mt-5" type="submit" :loading="hospitalSaving" :disabled="!hospitalForm.hospitalName || !hospitalForm.province || !hospitalForm.district">
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
import { SRI_LANKA_LOCATIONS, SRI_LANKAN_PROVINCES } from "../utils/sriLankaLocations";

type HospitalAssignment = {
  assignmentId: number;
  hospitalId: number;
  hospitalName: string;
  role: string;
  allModuleAccess: boolean;
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
  internalClinicianId: string | null;
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
  internalClinicianId: string | null;
  fullName: string;
  username: string;
  accountRole: string;
  accountDepartment: string | null;
  designation?: string | null;
  licenseNumber?: string | null;
  homeHospitalId: number;
  homeHospitalName: string;
};

type DataResponse<T> = { data?: T };

const assignmentRoles = ["ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "NURSE", "SURGEON", "RADIOLOGIST", "LAB_TECHNICIAN", "PHARMACIST", "RECEPTIONIST", "ECIS_SEARCHER"];
const departmentOptions = [
  "Administration", "OPD", "Clinics", "Emergency Department", "Medical Ward", "Surgical Ward",
  "Intensive Care Unit", "Laboratory", "Radiology / Imaging", "Pharmacy", "Operating Theatre",
  "Dental", "Medical Records", "Records Integration",
];
const suggestedDesignationByRole: Record<string, string> = {
  ADMIN: "Administrator",
  HOSPITAL_ADMIN: "Hospital Administrator",
  DOCTOR: "Medical Officer",
  NURSE: "Nursing Officer",
  SURGEON: "Surgeon",
  RADIOLOGIST: "Radiologist",
  LAB_TECHNICIAN: "Medical Laboratory Technologist",
  PHARMACIST: "Pharmacist",
  RECEPTIONIST: "Receptionist",
  ECIS_SEARCHER: "Records Officer",
};
const defaultRoleByDepartment: Record<string, string> = {
  OPD: "DOCTOR",
  Clinics: "DOCTOR",
  "Emergency Department": "DOCTOR",
  "Medical Ward": "DOCTOR",
  "Surgical Ward": "DOCTOR",
  "Intensive Care Unit": "DOCTOR",
  Laboratory: "LAB_TECHNICIAN",
  "Radiology / Imaging": "RADIOLOGIST",
  Pharmacy: "PHARMACIST",
  "Operating Theatre": "SURGEON",
  Dental: "DOCTOR",
  "Medical Records": "ECIS_SEARCHER",
  "Records Integration": "ECIS_SEARCHER",
};
const today = new Date().toISOString().slice(0, 10);
const context = ref<UserContext | null>(null);
const selectedAssignmentId = ref<number | null>(null);
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
const lastCreatedStaff = ref<Staff | null>(null);
let staffRoleChosenManually = false;
let assignmentRoleChosenManually = false;

const assignmentForm = ref({
  hospitalId: null as number | null,
  role: "DOCTOR",
  department: "",
  designation: "",
  licenseNumber: "",
  startDate: today,
});

const hospitalForm = ref({
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
  (assignment) => assignment.assignmentId === selectedAssignmentId.value,
) || null);
const normalizedRole = computed(() => String(context.value?.role || "").trim().toUpperCase());
const canManageAssignments = computed(() => ["SYSTEM_ADMIN", "ADMIN", "HOSPITAL_ADMIN"].includes(normalizedRole.value));
const canCreateHospitals = computed(() => normalizedRole.value === "SYSTEM_ADMIN");
const isHospitalAdministrator = computed(() => ["ADMIN", "HOSPITAL_ADMIN"].includes(normalizedRole.value));
const canSwitch = computed(() => selectedAssignmentId.value !== null && selectedAssignmentId.value !== context.value?.assignmentId && !switching.value);
const hospitalDistricts = computed(() => SRI_LANKA_LOCATIONS[hospitalForm.value.province] || []);
const staffRoleNotice = computed(() => {
  const defaultRole = defaultRoleByDepartment[staffAccountForm.value.department];
  if (!defaultRole || defaultRole === staffAccountForm.value.role) return "";
  return `The usual role for ${staffAccountForm.value.department} is ${defaultRole.replaceAll("_", " ")}. Confirm that the selected ${staffAccountForm.value.role.replaceAll("_", " ")} role matches this staff member's actual duties.`;
});
const assignmentRoleNotice = computed(() => {
  const defaultRole = defaultRoleByDepartment[assignmentForm.value.department];
  if (!defaultRole || defaultRole === assignmentForm.value.role) return "";
  return `The usual role for ${assignmentForm.value.department} is ${defaultRole.replaceAll("_", " ")}. Confirm that the selected ${assignmentForm.value.role.replaceAll("_", " ")} role matches this staff member's actual duties.`;
});

function messageFrom(errorValue: unknown, fallback: string) {
  return errorValue instanceof Error ? errorValue.message : fallback;
}

function clearFeedback() {
  error.value = "";
  success.value = "";
}

function designationSuggestion(role: string, department: string) {
  return department === "Dental" && role === "DOCTOR"
    ? "Dental Surgeon"
    : department
      ? suggestedDesignationByRole[role] || ""
      : "";
}

function suggestStaffDesignation() {
  staffAccountForm.value.designation = designationSuggestion(staffAccountForm.value.role, staffAccountForm.value.department);
}

function onStaffDepartmentChange() {
  const defaultRole = defaultRoleByDepartment[staffAccountForm.value.department];
  if (!staffRoleChosenManually && defaultRole) {
    staffAccountForm.value.role = defaultRole;
  }
  suggestStaffDesignation();
}

function onStaffRoleChange() {
  staffRoleChosenManually = true;
  suggestStaffDesignation();
}

function onAssignmentDepartmentChange() {
  const defaultRole = defaultRoleByDepartment[assignmentForm.value.department];
  if (!selectedStaff.value && !assignmentRoleChosenManually && defaultRole) {
    assignmentForm.value.role = defaultRole;
  }
  assignmentForm.value.designation = designationSuggestion(assignmentForm.value.role, assignmentForm.value.department);
}

function onAssignmentRoleChange() {
  assignmentRoleChosenManually = true;
  assignmentForm.value.designation = designationSuggestion(assignmentForm.value.role, assignmentForm.value.department);
}

async function loadContext() {
  loading.value = true;
  error.value = "";
  try {
    const response = await apiGet<DataResponse<UserContext>>("/auth/context");
    context.value = response?.data || null;
    selectedAssignmentId.value = context.value?.assignmentId || null;
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
  if (!canSwitch.value || !selectedAssignment.value) return;
  switching.value = true;
  clearFeedback();
  try {
    await switchHospitalContext(selectedAssignment.value.hospitalId, selectedAssignment.value.assignmentId);
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
  lastCreatedStaff.value = null;
  clearFeedback();
  try {
    const response = await apiPost<DataResponse<Staff>>(
      "/administration/users",
      staffAccountForm.value,
    );
    const staff = response.data;
    if (staff) {
      lastCreatedStaff.value = staff;
      selectedStaff.value = staff;
      staffResults.value = [staff];
      assignmentForm.value.hospitalId = staff.homeHospitalId;
      assignmentForm.value.role = staff.accountRole;
      assignmentForm.value.department = staff.accountDepartment || "";
      assignmentForm.value.designation = staff.designation || "";
      assignmentForm.value.licenseNumber = staff.licenseNumber || "";
      assignmentRoleChosenManually = false;
      success.value = `Created login for ${staff.fullName}. Employee number: ${staff.employeeNumber}.${staff.internalClinicianId ? ` Internal clinician ID: ${staff.internalClinicianId}.` : ""}${staff.licenseNumber ? ` Professional license on file: ${staff.licenseNumber}.` : ""} The staff member can now sign in with the credentials you provided.`;
    } else {
      success.value = "Staff login created.";
    }
    staffAccountForm.value = {
      hospitalId: context.value?.hospitalId || null,
      role: "DOCTOR",
      fullName: "",
      username: "",
      password: "",
      department: "",
      designation: "",
      licenseNumber: "",
      phone: "",
      email: "",
    };
    staffRoleChosenManually = false;
  } catch (createError) {
    error.value = messageFrom(createError, "Unable to create the staff login.");
  } finally {
    staffAccountSaving.value = false;
  }
}

function selectStaff(staff: Staff) {
  selectedStaff.value = staff;
  assignmentRoleChosenManually = false;
  if (assignmentRoles.includes(staff.accountRole)) assignmentForm.value.role = staff.accountRole;
  assignmentForm.value.department = staff.accountDepartment || "";
  assignmentForm.value.designation = staff.designation || designationSuggestion(assignmentForm.value.role, assignmentForm.value.department);
  assignmentForm.value.licenseNumber = staff.licenseNumber || "";
}

async function saveAssignment() {
  if (!selectedStaff.value || !assignmentForm.value.hospitalId) return;
  assignmentSaving.value = true;
  clearFeedback();
  try {
    const response = await apiPost<DataResponse<{ internalClinicianId: string | null }>>("/administration/assignments", {
      userId: selectedStaff.value.userId,
      hospitalId: assignmentForm.value.hospitalId,
      role: assignmentForm.value.role,
      department: assignmentForm.value.department || null,
      designation: assignmentForm.value.designation || null,
      licenseNumber: assignmentForm.value.licenseNumber || null,
      startDate: assignmentForm.value.startDate,
    });
    if (response.data?.internalClinicianId) selectedStaff.value.internalClinicianId = response.data.internalClinicianId;
    success.value = `${selectedStaff.value.fullName} now has an active ${assignmentForm.value.role.replaceAll("_", " ")} assignment.${response.data?.internalClinicianId ? ` Internal clinician ID: ${response.data.internalClinicianId}.` : ""}`;
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
    success.value = hospital ? `${hospital.hospitalName} was created with hospital code ${hospital.hospitalCode}. You can now assign authorized staff to it.` : "Hospital created. You can now assign authorized staff to it.";
    hospitalForm.value = { hospitalName: "", hospitalType: "", province: "", district: "", address: "", phone: "", email: "" };
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
