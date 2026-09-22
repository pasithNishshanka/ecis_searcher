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


    <!-- =========================================================
         ERROR
         ========================================================= -->

    <div
      v-if="error"
      class="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      {{ error }}
    </div>


    <!-- =========================================================
         STATISTICS
         ========================================================= -->

    <div class="grid gap-4 sm:grid-cols-3">
      <StatCard
        label="Active cases"
        :value="activeCases"
      />

      <StatCard
        label="Unidentified"
        :value="unidentifiedActiveCases"
      />

      <StatCard
        label="Identified"
        :value="identifiedActiveCases"
      />
    </div>


    <!-- =========================================================
         LOADING
         ========================================================= -->

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


    <!-- =========================================================
         EMERGENCY CASES
         ========================================================= -->

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
          class="flex flex-col justify-between gap-4 lg:flex-row"
        >
          <!-- Case information -->

          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <b>
                {{ e.case_number }}
              </b>

              <StatusBadge
                :label="e.status"
                :tone="statusTone(e)"
              />
            </div>


            <p class="mt-2 text-sm font-semibold text-slate-800">
              {{ emergencyDescription(e) }}
            </p>


            <p class="mt-1 text-xs text-slate-400">
              {{ formatDate(e.arrival_date) }}

              <span>
                ·
                {{ emergencyDepartment(e) }}
              </span>

              <span
                v-if="e.triage_level"
              >
                · Triage:
                {{ e.triage_level }}
              </span>
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
                ·
                {{ e.patient_name }}
              </span>
            </p>


            <p
              v-else-if="e.unidentified_patient"
              class="mt-1 text-xs font-semibold text-amber-700"
            >
              Identity has not yet been established.
            </p>
          </div>


          <!-- Actions -->

          <div
            class="flex flex-wrap items-start gap-2 lg:justify-end"
          >
            <BaseButton
              variant="secondary"
              size="sm"
              @click="openHistory(e)"
            >
              <template #icon>
                <History :size="15" />
              </template>

              View lifecycle
            </BaseButton>


            <RouterLink
              v-if="
                e.unidentified_patient &&
                e.status !== 'DISCHARGED'
              "
              :to="
                `/ecis?emergencyCaseId=${e.emergency_case_id}`
              "
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


        <!-- Current location summary -->

        <div
          v-if="
            currentLocationByCase[
              e.emergency_case_id
            ]
          "
          class="mt-4 rounded-xl border border-teal-100 bg-teal-50/60 p-3"
        >
          <div
            class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
          >
            <span
              class="font-bold text-teal-900"
            >
              Current location
            </span>

            <span class="text-teal-800">
              {{
                formatLocation(
                  currentLocationByCase[
                    e.emergency_case_id
                  ],
                )
              }}
            </span>
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


    <!-- =========================================================
         CREATE EMERGENCY CASE MODAL
         ========================================================= -->

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
          <BaseSelect
            v-model="f.arrivalMode"
          >
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
            placeholder="Enter the value accepted by the hospital database"
          />
        </FormField>


        <FormField label="Status">
          <BaseSelect
            v-model="f.status"
          >
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
            <BaseSelect
              v-model="f.patientId"
            >
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
              v-model="
                f.temporaryIdentityReference
              "
              placeholder="TEMP-EMG-005"
              required
            />
          </FormField>
        </div>


        <div
          class="sm:col-span-2 flex justify-end"
        >
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


    <!-- =========================================================
         EMERGENCY LIFECYCLE MODAL
         ========================================================= -->

    <Modal
      :open="!!historyCase"
      title="Emergency case lifecycle"
      description="Clinical and physical-location history for this emergency episode."
      @close="closeHistory"
    >
      <div
        v-if="historyCase"
        class="space-y-5"
      >
        <!-- Case header -->

        <div
          class="rounded-xl bg-slate-50 p-4"
        >
          <div
            class="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"
          >
            <div>
              <div
                class="flex flex-wrap items-center gap-2"
              >
                <p class="font-black text-slate-900">
                  {{ historyCase.case_number }}
                </p>

                <StatusBadge
                  :label="
                    historyCase.status
                  "
                  :tone="
                    statusTone(
                      historyCase,
                    )
                  "
                />
              </div>

              <p
                class="mt-2 text-sm text-slate-700"
              >
                {{
                  emergencyDescription(
                    historyCase,
                  )
                }}
              </p>
            </div>


            <BaseButton
              variant="secondary"
              size="sm"
              :disabled="historyLoading"
              @click="refreshHistory"
            >
              <template #icon>
                <RefreshCw :size="14" />
              </template>

              Refresh
            </BaseButton>
          </div>


          <div
            class="mt-4 grid gap-2 sm:grid-cols-2"
          >
            <InfoBox
              label="Arrival"
              :value="
                formatDate(
                  historyCase.arrival_date,
                )
              "
            />

            <InfoBox
              label="Arrival mode"
              :value="
                historyCase.arrival_mode ||
                '—'
              "
            />

            <InfoBox
              label="Triage"
              :value="
                historyCase.triage_level ||
                '—'
              "
            />

            <InfoBox
              label="Identity"
              :value="
                historyCase.unidentified_patient
                  ? 'Unidentified'
                  : historyCase.patient_number
                    ? `${historyCase.patient_number}${historyCase.patient_name ? ` · ${historyCase.patient_name}` : ''}`
                    : 'Identified'
              "
            />
          </div>
        </div>


        <!-- Current location -->

        <div>
          <div
            class="mb-2 flex items-center gap-2"
          >
            <MapPin
              :size="16"
              class="text-teal-700"
            />

            <h3 class="font-bold">
              Current location
            </h3>
          </div>


          <div
            v-if="historyLoading"
            class="rounded-xl border p-4 text-sm text-slate-400"
          >
            Loading current location...
          </div>


          <div
            v-else-if="
              currentLocation
            "
            class="rounded-xl border border-teal-100 bg-teal-50/50 p-4"
          >
            <p class="font-bold text-teal-900">
              {{
                formatLocation(
                  currentLocation,
                )
              }}
            </p>

            <p
              class="mt-1 text-xs text-teal-700"
            >
              Started:
              {{
                formatDate(
                  currentLocation.started_at,
                )
              }}
            </p>


            <p
              v-if="
                currentLocation.assigned_by_name
              "
              class="mt-1 text-xs text-teal-700"
            >
              Assigned by:
              {{
                currentLocation.assigned_by_name
              }}
            </p>
          </div>


          <div
            v-else
            class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500"
          >
            No active physical location is recorded.
          </div>
        </div>


        <!-- Location history -->

        <div>
          <div
            class="mb-3 flex items-center gap-2"
          >
            <Clock3
              :size="16"
              class="text-slate-600"
            />

            <h3 class="font-bold">
              Location history
            </h3>
          </div>


          <div
            v-if="historyLoading"
            class="rounded-xl border p-4 text-sm text-slate-400"
          >
            Loading location history...
          </div>


          <div
            v-else-if="
              locationHistory.length
            "
            class="space-y-3"
          >
            <div
              v-for="
                location in locationHistory
              "
              :key="
                location.emergency_case_location_id
              "
              class="relative rounded-xl border p-4"
            >
              <div
                class="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"
              >
                <div>
                  <span
                    class="badge bg-teal-100 text-teal-800"
                  >
                    {{
                      location.location_type
                    }}
                  </span>

                  <p
                    class="mt-2 font-bold text-slate-900"
                  >
                    {{
                      formatLocation(
                        location,
                      )
                    }}
                  </p>

                  <p
                    v-if="location.notes"
                    class="mt-1 whitespace-pre-line text-sm text-slate-600"
                  >
                    {{
                      location.notes
                    }}
                  </p>
                </div>


                <div
                  class="text-xs text-slate-400 sm:text-right"
                >
                  <p>
                    Start:
                    {{
                      formatDate(
                        location.started_at,
                      )
                    }}
                  </p>

                  <p class="mt-1">
                    End:
                    {{
                      location.ended_at
                        ? formatDate(
                            location.ended_at,
                          )
                        : "Current"
                    }}
                  </p>
                </div>
              </div>


              <p
                v-if="
                  location.assigned_by_name
                "
                class="mt-2 text-xs text-slate-400"
              >
                Assigned by:
                {{
                  location.assigned_by_name
                }}
              </p>
            </div>
          </div>


          <div
            v-else
            class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500"
          >
            No location history is recorded for this case.
          </div>
        </div>


        <!-- Clinical progression -->

        <div
          class="rounded-xl border border-slate-200 bg-white p-4"
        >
          <h3 class="font-bold">
            Episode progression
          </h3>

          <div
            class="mt-4 space-y-4"
          >
            <div
              class="flex gap-3"
            >
              <div
                class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-teal-600"
              />

              <div>
                <p class="font-semibold">
                  Emergency case created
                </p>

                <p class="text-xs text-slate-400">
                  {{
                    formatDate(
                      historyCase.arrival_date,
                    )
                  }}
                </p>
              </div>
            </div>


            <div
              class="flex gap-3"
              :class="
                historyCase.unidentified_patient
                  ? 'opacity-50'
                  : ''
              "
            >
              <div
                class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600"
              />

              <div>
                <p class="font-semibold">
                  Patient identity established
                </p>

                <p
                  v-if="
                    !historyCase.unidentified_patient
                  "
                  class="text-xs text-slate-500"
                >
                  {{
                    historyCase.patient_number ||
                    "Patient identified"
                  }}
                </p>

                <p
                  v-else
                  class="text-xs text-slate-400"
                >
                  Still pending
                </p>
              </div>
            </div>


            <div
              class="flex gap-3"
              :class="
                locationHistory.length
                  ? ''
                  : 'opacity-50'
              "
            >
              <div
                class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-purple-600"
              />

              <div>
                <p class="font-semibold">
                  Physical location recorded
                </p>

                <p class="text-xs text-slate-500">
                  {{
                    locationHistory.length
                      ? `${locationHistory.length} location record${locationHistory.length === 1 ? "" : "s"}`
                      : "No location recorded"
                  }}
                </p>
              </div>
            </div>


            <div
              class="flex gap-3"
              :class="
                historyCase.status ===
                'DISCHARGED'
                  ? ''
                  : 'opacity-50'
              "
            >
              <div
                class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-600"
              />

              <div>
                <p class="font-semibold">
                  Emergency episode discharged
                </p>

                <p
                  v-if="
                    historyCase.status ===
                    'DISCHARGED'
                  "
                  class="text-xs text-emerald-700"
                >
                  Episode closed
                </p>

                <p
                  v-else
                  class="text-xs text-slate-400"
                >
                  Episode still active
                </p>
              </div>
            </div>
          </div>
        </div>


        <!-- ECIS -->

        <div
          v-if="
            historyCase.unidentified_patient &&
            historyCase.status !==
              'DISCHARGED'
          "
          class="flex justify-end"
        >
          <RouterLink
            :to="
              `/ecis?emergencyCaseId=${historyCase.emergency_case_id}`
            "
            @click="closeHistory"
          >
            <BaseButton>
              Continue identity search
            </BaseButton>
          </RouterLink>
        </div>
      </div>
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

import {
  RouterLink,
} from "vue-router";

import {
  Clock3,
  History,
  MapPin,
  Plus,
  RefreshCw,
} from "lucide-vue-next";


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


interface EmergencyLocation {
  emergency_case_location_id: number;

  emergency_case_id: number;

  bed_id: number;

  location_type: string;

  started_at: string;

  ended_at?: string | null;

  assigned_by?: number | null;

  assigned_by_name?: string | null;

  notes?: string | null;

  bed_number?: string | null;

  bed_type?: string | null;

  bed_status?: string | null;

  ward_id?: number | null;

  ward_code?: string | null;

  ward_name?: string | null;

  ward_type?: string | null;

  floor?: string | null;

  location?: string | null;
}


interface InfoBoxProps {
  label: string;

  value: string;
}


/*
 * Small inline component for lifecycle metadata.
 */
const InfoBox = {
  props: {
    label: {
      type: String,
      required: true,
    },

    value: {
      type: String,
      required: true,
    },
  },

  template: `
    <div class="rounded-xl bg-white p-3">
      <p class="text-[10px] font-black uppercase tracking-wider text-slate-400">
        {{ label }}
      </p>

      <p class="mt-1 text-sm font-semibold text-slate-700">
        {{ value || "—" }}
      </p>
    </div>
  `,
};


/* ============================================================
   STATE
   ============================================================ */

const emergencies =
  ref<EmergencyCase[]>(
    [],
  );

const patients =
  ref<Patient[]>(
    [],
  );


const loading =
  ref(false);

const saving =
  ref(false);

const error =
  ref("");


const open =
  ref(false);


/*
 * Lifecycle modal state.
 */
const historyCase =
  ref<EmergencyCase | null>(
    null,
  );

const currentLocation =
  ref<EmergencyLocation | null>(
    null,
  );

const locationHistory =
  ref<EmergencyLocation[]>(
    [],
  );

const historyLoading =
  ref(false);


/*
 * Used on the main list so a current location
 * can be displayed without opening the modal.
 */
const currentLocationByCase =
  ref<Record<
    number,
    EmergencyLocation | null
  >>({});


/* ============================================================
   STATISTICS
   ============================================================ */

const activeCases =
  computed(() =>
    emergencies.value.filter(
      (e) =>
        e.status !==
        "DISCHARGED",
    ).length,
  );


const unidentifiedActiveCases =
  computed(() =>
    emergencies.value.filter(
      (e) =>
        e.status !==
          "DISCHARGED" &&
        e.unidentified_patient,
    ).length,
  );


const identifiedActiveCases =
  computed(() =>
    emergencies.value.filter(
      (e) =>
        e.status !==
          "DISCHARGED" &&
        !e.unidentified_patient,
    ).length,
  );


/* ============================================================
   NEW CASE FORM
   ============================================================ */

const f = reactive({
  chiefComplaint: "",

  initialCondition: "",

  arrivalMode: "WALK_IN",

  triageLevel: "",

  status:
    "IDENTIFICATION_PENDING",

  patientId: "",

  temporaryIdentityReference: "",
});


/* ============================================================
   LOAD EMERGENCY CASES
   ============================================================ */

async function loadEmergencies() {
  loading.value =
    true;

  error.value =
    "";

  try {
    const response =
      await apiGet<{
        success: boolean;

        count: number;

        data: EmergencyCase[];
      }>("/emergency");

    emergencies.value =
      response.data || [];


    /*
     * Clear old location cache before
     * rebuilding it from current cases.
     */
    currentLocationByCase.value =
      {};


    /*
     * Current location is supplementary information.
     *
     * A failed location request must NOT make
     * the entire emergency page fail.
     */
    await Promise.all(
      emergencies.value.map(
        async (emergencyCase) => {
          try {
            const locationResponse =
              await apiGet<{
                success: boolean;

                data:
                  | EmergencyLocation
                  | null;
              }>(
                `/emergency/${emergencyCase.emergency_case_id}/location`,
              );

            currentLocationByCase.value[
              emergencyCase.emergency_case_id
            ] =
              locationResponse.data ||
              null;
          } catch {
            currentLocationByCase.value[
              emergencyCase.emergency_case_id
            ] =
              null;
          }
        },
      ),
    );
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "Failed to load emergency cases.";

    emergencies.value =
      [];

    currentLocationByCase.value =
      {};
  } finally {
    loading.value =
      false;
  }
}


/* ============================================================
   LOAD PATIENTS
   ============================================================ */

async function loadPatients() {
  try {
    const response =
      await apiGet<{
        success: boolean;

        data: Patient[];
      }>("/patients");

    patients.value =
      response.data || [];
  } catch {
    patients.value =
      [];
  }
}


/* ============================================================
   CREATE CASE
   ============================================================ */

async function save() {
  error.value =
    "";

  saving.value =
    true;

  try {
    const isUnidentified =
      !f.patientId;


    const payload = {
      patientId:
        isUnidentified
          ? null
          : Number(
              f.patientId,
            ),

      caseNumber:
        f.temporaryIdentityReference ||
        `EMG-${Date.now()}`,

      arrivalDate:
        new Date().toISOString(),

      arrivalMode:
        f.arrivalMode,

      triageLevel:
        f.triageLevel ||
        null,

      chiefComplaint:
        f.chiefComplaint,

      initialCondition:
        f.initialCondition ||
        null,

      unidentifiedPatient:
        isUnidentified,

      temporaryIdentityReference:
        isUnidentified
          ? f.temporaryIdentityReference
          : null,
    };


    await apiPost(
      "/emergency",
      {
        ...payload,

        /*
         * Backend determines permitted hospital
         * from the authenticated user/JWT.
         */
        hospitalId:
          getHospitalId(),
      },
    );


    open.value =
      false;

    resetForm();

    await loadEmergencies();
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "Failed to create emergency case.";
  } finally {
    saving.value =
      false;
  }
}


/* ============================================================
   AUTHENTICATED HOSPITAL
   ============================================================ */

function getHospitalId():
  number {
  const userRaw =
    localStorage.getItem(
      "ecis-user",
    );

  if (!userRaw) {
    throw new Error(
      "Authenticated hospital information is missing.",
    );
  }


  let user: any;

  try {
    user =
      JSON.parse(
        userRaw,
      );
  } catch {
    throw new Error(
      "Authenticated user information is invalid.",
    );
  }


  if (!user?.hospitalId) {
    throw new Error(
      "Authenticated user's hospital is missing.",
    );
  }


  return Number(
    user.hospitalId,
  );
}


/* ============================================================
   RESET FORM
   ============================================================ */

function resetForm() {
  Object.assign(
    f,
    {
      chiefComplaint:
        "",

      initialCondition:
        "",

      arrivalMode:
        "WALK_IN",

      triageLevel:
        "",

      status:
        "IDENTIFICATION_PENDING",

      patientId:
        "",

      temporaryIdentityReference:
        "",
    },
  );
}


/* ============================================================
   LIFECYCLE
   ============================================================ */

async function openHistory(
  emergencyCase: EmergencyCase,
) {
  historyCase.value =
    emergencyCase;

  currentLocation.value =
    null;

  locationHistory.value =
    [];

  historyLoading.value =
    true;


  try {
    await refreshHistory();
  } finally {
    historyLoading.value =
      false;
  }
}


async function refreshHistory() {
  if (
    !historyCase.value
  ) {
    return;
  }


  historyLoading.value =
    true;


  try {
    const [
      caseResponse,
      locationResponse,
      historyResponse,
    ] = await Promise.all([
      apiGet<{
        success: boolean;

        data: EmergencyCase;
      }>(
        `/emergency/${historyCase.value.emergency_case_id}`,
      ),

      apiGet<{
        success: boolean;

        data:
          | EmergencyLocation
          | null;
      }>(
        `/emergency/${historyCase.value.emergency_case_id}/location`,
      ),

      apiGet<{
        success: boolean;

        count: number;

        data: EmergencyLocation[];
      }>(
        `/emergency/${historyCase.value.emergency_case_id}/location/history`,
      ),
    ]);


    if (
      caseResponse?.data
    ) {
      historyCase.value =
        caseResponse.data;


      /*
       * Also keep the main list in sync.
       */
      const index =
        emergencies.value.findIndex(
          (item) =>
            item.emergency_case_id ===
            caseResponse.data.emergency_case_id,
        );


      if (index >= 0) {
        emergencies.value[
          index
        ] =
          caseResponse.data;
      }
    }


    currentLocation.value =
      locationResponse.data ||
      null;


    locationHistory.value =
      historyResponse.data ||
      [];


    if (
      historyCase.value
    ) {
      currentLocationByCase.value[
        historyCase.value.emergency_case_id
      ] =
        currentLocation.value;
    }
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "Unable to load emergency lifecycle history.";
  } finally {
    historyLoading.value =
      false;
  }
}


function closeHistory() {
  historyCase.value =
    null;

  currentLocation.value =
    null;

  locationHistory.value =
    [];
}


/* ============================================================
   DISPLAY HELPERS
   ============================================================ */

function emergencyDescription(
  e: EmergencyCase,
) {
  return (
    e.chief_complaint ||
    e.initial_condition ||
    "Emergency case"
  );
}


function emergencyDepartment(
  e: EmergencyCase,
) {
  return (
    e.arrival_mode ||
    "Emergency department"
  );
}


function formatDate(
  value:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return "-";
  }


  const date =
    new Date(
      value,
    );


  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return String(
      value,
    );
  }


  return date.toLocaleString();
}


function formatLocation(
  location:
    | EmergencyLocation
    | null
    | undefined,
) {
  if (!location) {
    return "No active location";
  }


  const parts =
    [
      location.location_type,

      location.ward_name,

      location.bed_number
        ? `Bed ${location.bed_number}`
        : "",
    ].filter(
      Boolean,
    );


  return parts.join(
    " · ",
  );
}


function statusTone(
  emergencyCase: EmergencyCase,
) {
  if (
    emergencyCase.status ===
    "DISCHARGED"
  ) {
    return "neutral";
  }


  if (
    emergencyCase.unidentified_patient
  ) {
    return "warning";
  }


  if (
    emergencyCase.status ===
    "IDENTIFIED"
  ) {
    return "success";
  }


  return "info";
}


/* ============================================================
   INITIAL LOAD
   ============================================================ */

onMounted(async () => {
  await Promise.all([
    loadEmergencies(),
    loadPatients(),
  ]);
});
</script>