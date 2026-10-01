<template>
  <div>
    <PageHeader eyebrow="Inpatient department" title="Wards & Beds"
      description="Quickly view ward occupancy, bed status and the patient assigned to each bed.">
      <div class="flex flex-wrap gap-2">
        <BaseButton @click="showWardForm = true"><template #icon>
            <Plus :size="16" />
          </template>Add ward</BaseButton>
      </div>
    </PageHeader>

    <!-- Quick ward access -->
    <div class="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <button v-for="w in wards" :key="w.id" @click="scrollToWard(w.id)"
        class="card p-4 text-left transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md">
        <div class="flex items-center justify-between">
          <span class="text-xs font-black uppercase tracking-wider text-teal-700">{{ w.department }}</span>
          <span class="text-xs font-bold text-slate-400">Floor {{ w.floor }}</span>
        </div>
        <h3 class="mt-2 font-black text-slate-900">{{ w.name }}</h3>
        <div class="mt-3 flex justify-between text-xs">
          <span>{{ occ(w) }} occupied</span>
          <b class="text-emerald-700">{{ w.capacity - occ(w) }} free</b>
        </div>
        <div class="mt-2 h-1.5 rounded-full bg-slate-100">
          <div class="h-1.5 rounded-full bg-teal-600" :style="{ width: `${w.capacity ? occ(w) / w.capacity * 100 : 0}%` }">
          </div>
        </div>
      </button>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <StatCard label="Total beds" :value="totalBeds" />
      <StatCard label="Occupied" :value="occupied" />
      <StatCard label="Available" :value="available" />
    </div>

    <div class="mt-6 space-y-5">
      <section v-for="w in wards" :key="w.id" :id="`ward-${w.id}`" class="card overflow-hidden scroll-mt-24">
        <div class="border-b bg-slate-50/70 p-5">
          <div class="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="section-title">{{ w.name }}</h2>
                <span class="badge">{{ w.id }}</span>
              </div>
              <p class="muted">{{ w.department }} · Floor {{ w.floor }} · {{ w.capacity }} beds</p>
            </div>
            <div class="flex gap-4 text-sm">
              <div><b>{{ occ(w) }}</b><span class="ml-1 text-slate-400">occupied</span></div>
              <div><b class="text-emerald-700">{{ w.capacity - occ(w) }}</b><span
                  class="ml-1 text-slate-400">available</span>
              </div>
            </div>
          </div>
          <div class="mt-4 h-2 rounded-full bg-slate-200">
            <div class="h-2 rounded-full bg-teal-600" :style="{ width: `${w.capacity ? occ(w) / w.capacity * 100 : 0}%` }">
            </div>
          </div>
        </div>

        <div class="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="b in w.beds" :key="b.id" class="rounded-xl border p-4"
            :class="b.status === 'OCCUPIED' ? 'border-blue-100 bg-blue-50/50' : b.status === 'MAINTENANCE' ? 'border-amber-100 bg-amber-50/50' : 'border-emerald-100 bg-emerald-50/40'">
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-xs font-black uppercase tracking-wider text-slate-400">Bed</p>
                <p class="mt-1 text-lg font-black text-slate-900">{{ b.number }}</p>
              </div>
              <span class="badge"
                :class="b.status === 'OCCUPIED' ? 'bg-blue-100 text-blue-700' : b.status === 'MAINTENANCE' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'">{{ b.status }}</span>
            </div>

            <div v-if="b.patientId" class="mt-4 rounded-xl bg-white p-3">
              <p class="text-[10px] font-black uppercase tracking-wider text-slate-400">Current patient</p>
              <p class="mt-1 font-bold">{{ patientName(b.patientId) }}</p>
              <p class="text-xs text-slate-400">{{ b.patientId }}</p>

              <p v-if="b.admissionNumber" class="mt-2 text-xs text-slate-500">
                <span class="font-semibold">Admission:</span> {{ b.admissionNumber }}
              </p>

              <div class="mt-3 grid gap-2 sm:grid-cols-2">
                <RouterLink :to="`/patients/${b.patientId}`">
                  <BaseButton variant="secondary" block size="sm">Patient EHR</BaseButton>
                </RouterLink>

                <BaseButton
                  variant="secondary"
                  block
                  size="sm"
                  @click="viewPatient(b.patientId)"
                >
                  View
                </BaseButton>
              </div>

              <BaseButton
                v-if="canCorrectDoctor && b.admissionId"
                variant="secondary"
                block
                size="sm"
                class="mt-2"
                @click="openDoctorCorrection(b)"
              >
                Attending doctor
              </BaseButton>

              <BaseButton
                v-if="b.admissionId"
                variant="danger"
                block
                size="sm"
                class="mt-2"
                @click="openDischarge(b)"
              >
                Discharge patient
              </BaseButton>
            </div>

            <div v-else-if="b.status === 'AVAILABLE'" class="mt-4">
              <BaseButton block @click="openAssignment(w, b)">
                <template #icon>
                  <UserPlus :size="15" />
                </template>
                Assign patient
              </BaseButton>
            </div>

            <div v-else class="mt-4 text-xs text-amber-700">
              This bed is unavailable for assignment.
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Add ward -->
    <Modal
      :open="showWardForm"
      title="Add hospital ward"
      description="Ward and bed capacity are configurable for each hospital."
      @close="showWardForm = false"
    >
      <form @submit.prevent="saveWard" class="grid gap-4 sm:grid-cols-2">
        <FormField label="Ward name" required>
          <BaseInput v-model="wf.name" placeholder="Medical Ward B" required />
        </FormField>

        <FormField label="Department" required>
          <BaseInput v-model="wf.department" placeholder="Medicine" required />
        </FormField>

        <FormField label="Floor" required>
          <BaseInput v-model="wf.floor" placeholder="3" required />
        </FormField>

        <FormField label="Bed count" required>
          <BaseInput v-model.number="wf.capacity" type="number" min="1" max="200" required />
        </FormField>

        <div class="sm:col-span-2 flex justify-end">
          <BaseButton type="submit">Create ward</BaseButton>
        </div>
      </form>
    </Modal>

    <!-- Patient assignment -->
    <Modal
      :open="!!assignment"
      title="Assign patient to bed"
      description="Search the registered patient by name, patient ID or NIC. No large dropdown is required."
      @close="assignment = null"
    >
      <div v-if="assignment">
        <div class="rounded-xl bg-slate-50 p-4">
          <p class="text-xs font-bold text-slate-400">Selected bed</p>
          <p class="font-black">{{ assignment.b.number }} · {{ assignment.w.name }}</p>
        </div>

        <FormField class="mt-5" label="Search registered patient">
          <div class="relative">
            <BaseInput
              v-model="patientSearch"
              class="pr-10"
              placeholder="Type name, patient ID or NIC..."
              autofocus
            />

            <BaseButton
              v-if="patientSearch"
              variant="ghost"
              size="sm"
              type="button"
              class="absolute right-1 top-1 min-h-8 px-2"
              @click="patientSearch = ''"
            >
              ×
            </BaseButton>
          </div>
        </FormField>

        <div class="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-200">
          <button
            v-for="p in patientMatches"
            :key="p.id"
            @click="selectedPatient = p.id"
            class="flex w-full items-center gap-3 border-b border-slate-100 p-3 text-left last:border-0 hover:bg-teal-50"
            :class="selectedPatient === p.id ? 'bg-teal-50' : ''"
          >
            <div class="avatar">{{ p.firstName[0] }}{{ p.lastName[0] }}</div>

            <div class="min-w-0 flex-1">
              <p class="font-bold">{{ p.firstName }} {{ p.lastName }}</p>
              <p class="text-xs text-slate-400">
                {{ p.patientNumber }} · {{ p.nic || 'NIC not recorded' }} · {{ p.district }}
              </p>
            </div>

            <span
              v-if="selectedPatient === p.id"
              class="font-black text-teal-700"
            >
              ✓
            </span>
          </button>

          <div
            v-if="!patientSearch"
            class="p-5 text-center text-xs text-slate-400"
          >
            Start typing to find a patient.
          </div>

          <div
            v-else-if="!patientMatches.length"
            class="p-5 text-center text-xs text-slate-400"
          >
            No registered patient matches "{{ patientSearch }}".
          </div>
        </div>

        <div
          v-if="selectedPatient"
          class="mt-4 rounded-xl bg-teal-50 p-3 text-sm"
        >
          Selected:
          <b>{{ patientName(selectedPatient) }}</b>
          · {{ selectedPatient }}
        </div>

        <FormField v-if="requiresDoctorSelection" class="mt-4" label="Attending doctor" required>
          <BaseSelect v-model="selectedDoctorId" required>
            <option value="">Select an assigned doctor</option>
            <option v-for="doctor in doctorOptions" :key="doctor.userId" :value="String(doctor.userId)">
              {{ doctor.fullName }}{{ doctor.designation ? ` · ${doctor.designation}` : '' }}
            </option>
          </BaseSelect>
          <p v-if="!doctorOptions.length" class="muted mt-1">No doctor is assigned to this hospital. Add one in Settings.</p>
        </FormField>

        <p v-if="assignmentError" class="mt-3 text-sm text-red-700">{{ assignmentError }}</p>

        <BaseButton
          block
          class="mt-4"
          :disabled="!selectedPatient || (requiresDoctorSelection && !selectedDoctorId) || assigning"
          :loading="assigning"
          @click="assign"
        >
          Assign selected patient
        </BaseButton>
      </div>
    </Modal>

    <!-- Patient quick details -->
    <Modal
      :open="!!patientDetail"
      title="Current bed patient"
      description="Quick patient details from the existing EHR."
      @close="patientDetail = null"
    >
      <div v-if="patientDetail" class="space-y-4">
        <div class="flex gap-3">
          <div class="avatar">
            {{ patientDetail.firstName[0] }}{{ patientDetail.lastName[0] }}
          </div>

          <div>
            <h3 class="font-black">
              {{ patientDetail.firstName }}
              {{ patientDetail.lastName }}
            </h3>

            <p class="text-xs text-slate-400">
              {{ patientDetail.patientNumber }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <Info label="Blood" :value="patientDetail.bloodGroup" />
          <Info label="Age" :value="`${age(patientDetail.dateOfBirth)} years`" />
          <Info label="Height" :value="`${patientDetail.heightCm} cm`" />
          <Info label="District" :value="patientDetail.district" />
        </div>

        <RouterLink :to="`/patients/${patientDetail.id}`">
          <BaseButton block>Open complete EHR</BaseButton>
        </RouterLink>
      </div>
    </Modal>

    <!-- Discharge -->
    <Modal
      :open="!!dischargeTarget"
      title="Discharge inpatient"
      description="Complete the discharge diagnosis and discharge summary before releasing the occupied bed."
      @close="closeDischarge"
    >
      <div v-if="dischargeTarget" class="space-y-4">
        <div class="rounded-xl bg-slate-50 p-4">
          <p class="text-xs font-bold uppercase tracking-wider text-slate-400">
            Patient
          </p>

          <p class="mt-1 font-black">
            {{ patientName(dischargeTarget.patientId || '') }}
          </p>

          <p class="mt-1 text-xs text-slate-500">
            Bed {{ dischargeTarget.number }}

            <span v-if="dischargeTarget.admissionNumber">
              · {{ dischargeTarget.admissionNumber }}
            </span>
          </p>
        </div>

        <FormField label="Discharge diagnosis" required>
          <BaseInput
            v-model="dischargeForm.dischargeDiagnosis"
            placeholder="Enter the final discharge diagnosis"
            :disabled="discharging"
            required
          />
        </FormField>

        <FormField label="Discharge summary" required>
          <BaseTextarea
            v-model="dischargeForm.dischargeSummary"
            placeholder="Record the patient's treatment outcome, condition at discharge and relevant follow-up information."
            rows="6"
            :disabled="discharging"
            required
          />
        </FormField>

        <div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Confirming discharge will mark the admission as
          <b>DISCHARGED</b> and release the current bed.
        </div>

        <div class="flex justify-end gap-2">
          <BaseButton
            variant="secondary"
            :disabled="discharging"
            @click="closeDischarge"
          >
            Cancel
          </BaseButton>

          <BaseButton
            variant="danger"
            :loading="discharging"
            :disabled="!canSubmitDischarge"
            @click="submitDischarge"
          >
            Confirm discharge
          </BaseButton>
        </div>
      </div>
    </Modal>

    <Modal
      :open="!!doctorCorrectionTarget"
      title="Attending doctor"
      description="Link a verified, hospital-assigned doctor to an active admission when none is recorded. This correction is audited."
      @close="closeDoctorCorrection"
    >
      <div v-if="doctorCorrectionTarget" class="space-y-4">
        <p class="text-sm font-semibold">{{ doctorCorrectionTarget.admissionNumber || `Admission ${doctorCorrectionTarget.admissionId}` }}</p>
        <p v-if="doctorCorrectionLoading" class="muted">Loading admission and assigned doctors...</p>
        <template v-else-if="doctorCorrectionAdmission?.doctor_id">
          <p class="rounded-xl bg-teal-50 p-3 text-sm text-teal-800">
            Attending doctor already recorded: {{ doctorCorrectionAdmission.doctor_name }}. This workflow does not overwrite it.
          </p>
        </template>
        <template v-else>
          <FormField label="Verified attending doctor" required>
            <BaseSelect v-model="correctionDoctorId" :disabled="doctorCorrectionSaving">
              <option value="">Select a doctor assigned to this hospital</option>
              <option v-for="doctor in correctionDoctors" :key="doctor.userId" :value="String(doctor.userId)">
                {{ doctor.fullName }}{{ doctor.designation ? ` · ${doctor.designation}` : '' }}
              </option>
            </BaseSelect>
          </FormField>
          <p v-if="!correctionDoctors.length" class="text-sm text-amber-800">
            No authorized doctor is assigned here. Create and assign the verified staff account in Settings first.
          </p>
          <FormField label="Reason for correcting this admission" required>
            <BaseTextarea v-model="correctionReason" rows="3" placeholder="Document how the attending doctor was verified" :disabled="doctorCorrectionSaving" />
          </FormField>
          <BaseButton :disabled="!correctionDoctorId || correctionReason.trim().length < 10 || doctorCorrectionSaving" :loading="doctorCorrectionSaving" @click="saveDoctorCorrection">
            Save attending doctor
          </BaseButton>
        </template>
        <p v-if="doctorCorrectionError" class="text-sm text-red-700">{{ doctorCorrectionError }}</p>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Plus, UserPlus } from 'lucide-vue-next'

import PageHeader from '../components/PageHeader.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseInput from '../components/ui/BaseInput.vue'
import BaseSelect from '../components/ui/BaseSelect.vue'
import BaseTextarea from '../components/ui/BaseTextarea.vue'
import FormField from '../components/forms/FormField.vue'
import StatCard from '../components/StatCard.vue'
import Modal from '../components/Modal.vue'
import { useEHR } from '../stores/ehr'
import { apiGet, apiPut } from '../services/api'

const Info = {
  props: ['label', 'value'],
  template: `
    <div class="rounded-xl bg-slate-50 p-3">
      <p class="label">{{ label }}</p>
      <p class="mt-1 text-sm font-bold">{{ value }}</p>
    </div>
  `,
}

const {
  wards,
  patients,
  addWard,
  assignBed,
  dischargeAdmission,
  refresh,
} = useEHR()

const showWardForm = ref(false)
const assignment = ref<any>(null)
const patientSearch = ref('')
const selectedPatient = ref('')
type DoctorOption = { userId: number; fullName: string; designation: string | null }
const doctorOptions = ref<DoctorOption[]>([])
const doctorCorrectionTarget = ref<any>(null)
const doctorCorrectionAdmission = ref<any>(null)
const correctionDoctors = ref<DoctorOption[]>([])
const correctionDoctorId = ref('')
const correctionReason = ref('')
const doctorCorrectionError = ref('')
const doctorCorrectionLoading = ref(false)
const doctorCorrectionSaving = ref(false)
const canCorrectDoctor = (() => {
  try {
    return ['ADMIN', 'SYSTEM_ADMIN'].includes(String(JSON.parse(localStorage.getItem('ecis-user') || '{}').role || '').toUpperCase())
  } catch {
    return false
  }
})()
const selectedDoctorId = ref('')
const assignmentError = ref('')
const assigning = ref(false)
const requiresDoctorSelection = (() => {
  try {
    return String(JSON.parse(localStorage.getItem('ecis-user') || '{}').role || '').toUpperCase() !== 'DOCTOR'
  } catch {
    return true
  }
})()
const patientDetail = ref<any>(null)

const dischargeTarget = ref<any>(null)
const discharging = ref(false)

const dischargeForm = reactive({
  dischargeDiagnosis: '',
  dischargeSummary: '',
})

const wf = reactive({
  name: '',
  department: 'Medicine',
  floor: '1',
  capacity: 20,
})

const totalBeds = computed(() =>
  wards.value.reduce(
    (n, w) => n + w.capacity,
    0,
  ),
)

const occupied = computed(() =>
  wards.value.reduce(
    (n, w) => n + occ(w),
    0,
  ),
)

const available = computed(() =>
  totalBeds.value - occupied.value,
)

const patientMatches = computed(() => {
  const query = patientSearch.value.trim().toLowerCase()
  if (!query) return []
  return patients.value
    .filter((p) =>
      `${p.firstName} ${p.lastName} ${p.patientNumber} ${p.nic}`
        .toLowerCase()
        .includes(query),
    )
    .slice(0, 20)
})

const canSubmitDischarge = computed(() =>
  !!dischargeTarget.value?.admissionId &&
  dischargeForm.dischargeDiagnosis.trim().length > 0 &&
  dischargeForm.dischargeSummary.trim().length > 0 &&
  !discharging.value,
)

function occ(w: any) {
  return w.beds.filter(
    (b: any) =>
      b.status === 'OCCUPIED',
  ).length
}

function patientName(id: string) {
  const p = patients.value.find(
    (x) => x.id === id,
  )

  return p
    ? `${p.firstName} ${p.lastName}`
    : 'Unknown patient'
}

function age(d: string) {
  return Math.floor(
    (Date.now() - new Date(d).getTime()) /
      31557600000,
  )
}

async function saveWard() {
  try {
    await addWard(
      wf.name,
      wf.department,
      wf.floor,
      wf.capacity,
    )

    showWardForm.value = false

    Object.assign(wf, {
      name: '',
      department: 'Medicine',
      floor: '1',
      capacity: 20,
    })
  } catch (error) {
    window.alert(
      error instanceof Error
        ? error.message
        : 'Unable to create ward.',
    )
  }
}

async function openAssignment(
  w: any,
  b: any,
) {
  assignment.value = {
    w,
    b,
  }

  patientSearch.value = ''
  selectedPatient.value = ''
  selectedDoctorId.value = ''
  assignmentError.value = ''
  doctorOptions.value = []
  if (requiresDoctorSelection) {
    try {
      const response = await apiGet<{ data?: DoctorOption[] }>('/providers?role=DOCTOR')
      doctorOptions.value = response.data || []
    } catch (error) {
      assignmentError.value = error instanceof Error ? error.message : 'Unable to load assigned doctors.'
    }
  }
}

async function openDoctorCorrection(b: any) {
  if (!b?.admissionId) return
  doctorCorrectionTarget.value = b
  doctorCorrectionAdmission.value = null
  correctionDoctors.value = []
  correctionDoctorId.value = ''
  correctionReason.value = ''
  doctorCorrectionError.value = ''
  doctorCorrectionLoading.value = true
  try {
    const [admission, doctors] = await Promise.all([
      apiGet<{ data?: any }>(`/admissions/${encodeURIComponent(b.admissionId)}`),
      apiGet<{ data?: DoctorOption[] }>('/providers?role=DOCTOR'),
    ])
    if (!admission.data) throw new Error('Admission details are unavailable.')
    doctorCorrectionAdmission.value = admission.data
    correctionDoctors.value = doctors.data || []
  } catch (error) {
    doctorCorrectionError.value = error instanceof Error ? error.message : 'Unable to load attending doctors.'
  } finally {
    doctorCorrectionLoading.value = false
  }
}

function closeDoctorCorrection() {
  if (doctorCorrectionSaving.value) return
  doctorCorrectionTarget.value = null
}

async function saveDoctorCorrection() {
  const admissionId = doctorCorrectionTarget.value?.admissionId
  if (!admissionId || !correctionDoctorId.value || correctionReason.value.trim().length < 10 || doctorCorrectionSaving.value) return
  doctorCorrectionSaving.value = true
  doctorCorrectionError.value = ''
  try {
    await apiPut(`/admissions/${encodeURIComponent(admissionId)}/attending-doctor`, {
      doctorId: Number(correctionDoctorId.value),
      reason: correctionReason.value.trim(),
    })
    await refresh()
    doctorCorrectionTarget.value = null
  } catch (error) {
    doctorCorrectionError.value = error instanceof Error ? error.message : 'Unable to assign the attending doctor.'
  } finally {
    doctorCorrectionSaving.value = false
  }
}

async function assign() {
  if (
    !assignment.value ||
    !selectedPatient.value ||
    (requiresDoctorSelection && !selectedDoctorId.value) ||
    assigning.value
  ) {
    return
  }

  assigning.value = true
  assignmentError.value = ''
  try {
    await assignBed(
      assignment.value.w.id,
      assignment.value.b.id,
      selectedPatient.value,
      selectedDoctorId.value || undefined,
    )

    assignment.value = null
    patientSearch.value = ''
    selectedPatient.value = ''
  } catch (error) {
    assignmentError.value = error instanceof Error ? error.message : 'Unable to assign patient to the bed.'
  } finally {
    assigning.value = false
  }
}

function viewPatient(id: string) {
  patientDetail.value =
    patients.value.find(
      (p) => p.id === id,
    ) || null
}

function scrollToWard(id: string) {
  document
    .getElementById(`ward-${id}`)
    ?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
}

function openDischarge(b: any) {
  if (!b?.admissionId) {
    window.alert(
      'No active admission was found for this occupied bed.',
    )

    return
  }

  dischargeTarget.value = b

  dischargeForm.dischargeDiagnosis = ''
  dischargeForm.dischargeSummary = ''
}

function closeDischarge(
  force = false,
) {
  if (
    discharging.value &&
    !force
  ) {
    return
  }

  dischargeTarget.value = null

  dischargeForm.dischargeDiagnosis = ''
  dischargeForm.dischargeSummary = ''
}

async function submitDischarge() {
  if (
    !canSubmitDischarge.value
  ) {
    return
  }

  discharging.value = true

  try {
    await dischargeAdmission(
      String(
        dischargeTarget.value.admissionId,
      ),
      dischargeForm.dischargeDiagnosis,
      dischargeForm.dischargeSummary,
    )

    window.alert(
      'Patient discharged successfully. The bed is now available.',
    )

    closeDischarge(true)
  } catch (error) {
    window.alert(
      error instanceof Error
        ? error.message
        : 'Unable to discharge the patient.',
    )
  } finally {
    discharging.value = false
  }
}
</script>
