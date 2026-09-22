<template>
  <div>
    <PageHeader
      eyebrow="Specialty outpatient services"
      title="Clinics"
      description="Manage specialty clinic visits against the patient's existing longitudinal EHR."
    >
      <BaseButton
        :disabled="
          !selectedPatient ||
          !selectedClinic
        "
        @click="openVisitForm"
      >
        <template #icon>
          <Plus :size="16" />
        </template>

        New clinic visit
      </BaseButton>
    </PageHeader>


    <!-- =========================================================
         ERROR
         ========================================================= -->

    <div
      v-if="error"
      class="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      {{ error }}
    </div>


    <!-- =========================================================
         CLINIC LOADING
         ========================================================= -->

    <div
      v-if="loadingClinics"
      class="card mb-6 p-6 text-sm text-slate-400"
    >
      Loading hospital clinics...
    </div>


    <!-- =========================================================
         NO CLINICS
         ========================================================= -->

    <div
      v-else-if="!clinics.length"
      class="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"
    >
      <p
        class="font-bold text-amber-900"
      >
        No active clinics are configured for this hospital.
      </p>

      <p
        class="mt-1 text-sm text-amber-800"
      >
        An administrator needs to configure the hospital's specialty clinics before clinic visits can be registered.
      </p>
    </div>


    <!-- =========================================================
         CLINIC SELECTOR
         ========================================================= -->

    <div
      v-else
      class="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <button
        v-for="clinic in clinics"
        :key="
          clinic.clinic_id
        "
        type="button"
        class="rounded-2xl border p-4 text-left transition"
        :class="
          selectedClinic?.clinic_id ===
          clinic.clinic_id
            ? 'border-teal-300 bg-teal-50 shadow-sm'
            : 'border-slate-200 bg-white hover:border-teal-200 hover:shadow-sm'
        "
        @click="
          selectClinic(clinic)
        "
      >
        <div
          class="flex items-start justify-between gap-3"
        >
          <div>
            <span
              class="text-[10px] font-black uppercase tracking-wider text-teal-700"
            >
              {{
                clinic.clinic_code
              }}
            </span>

            <h3
              class="mt-1 font-black text-slate-900"
            >
              {{
                clinic.clinic_name
              }}
            </h3>
          </div>

          <Check
            v-if="
              selectedClinic?.clinic_id ===
              clinic.clinic_id
            "
            :size="18"
            class="shrink-0 text-teal-700"
          />
        </div>

        <p
          class="mt-2 text-xs text-slate-500"
        >
          {{
            clinic.specialty ||
            "Specialty not recorded"
          }}
        </p>

        <p
          v-if="clinic.location"
          class="mt-1 text-xs text-slate-400"
        >
          {{
            clinic.location
          }}
        </p>
      </button>
    </div>


    <!-- =========================================================
         MAIN CONTENT
         ========================================================= -->

    <div
      class="grid gap-6 xl:grid-cols-[320px_1fr]"
    >
      <!-- Patient selector -->

      <aside
        class="card p-5"
      >
        <h2
          class="section-title text-base"
        >
          Registered patients
        </h2>

        <p
          class="muted mt-1"
        >
          Select the existing patient before opening a clinic consultation.
        </p>

        <PatientLookup
          v-model="
            selectedPatient
          "
          :patients="
            patients
          "
          class="mt-4"
          label=""
          placeholder="Search name / ID / NIC"
        />

        <div
          v-if="
            selectedPatient
          "
          class="mt-5 rounded-xl bg-teal-50 p-4"
        >
          <p
            class="text-xs font-black uppercase tracking-wider text-teal-700"
          >
            Selected patient
          </p>

          <p
            class="mt-1 font-black text-teal-950"
          >
            {{
              selectedPatient.firstName
            }}
            {{
              selectedPatient.lastName
            }}
          </p>

          <p
            class="text-xs text-teal-800"
          >
            {{
              selectedPatient.patientNumber
            }}
          </p>
        </div>
      </aside>


      <!-- Patient history -->

      <main
        v-if="
          selectedPatient
        "
        class="space-y-5"
      >
        <section
          class="card p-5"
        >
          <div
            class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"
          >
            <div>
              <p
                class="text-xs font-black uppercase tracking-wider text-teal-700"
              >
                Patient EHR
              </p>

              <h2
                class="mt-1 section-title"
              >
                {{
                  selectedPatient.firstName
                }}
                {{
                  selectedPatient.lastName
                }}
              </h2>

              <p
                class="muted"
              >
                {{
                  selectedPatient.patientNumber
                }}
              </p>
            </div>

            <RouterLink
              :to="
                `/patients/${selectedPatient.id}`
              "
            >
              <BaseButton
                variant="secondary"
              >
                Open full EHR

                <ArrowRight
                  :size="15"
                />
              </BaseButton>
            </RouterLink>
          </div>
        </section>


        <section
          class="card overflow-hidden"
        >
          <div
            class="border-b p-5"
          >
            <div
              class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
            >
              <div>
                <h2
                  class="section-title"
                >
                  Clinic history
                </h2>

                <p
                  class="muted mt-1"
                >
                  Specialty clinic visits remain linked to this patient's hospital record.
                </p>
              </div>

              <div
                class="flex items-center gap-2"
              >
                <span
                  class="badge bg-teal-50 text-teal-700"
                >
                  {{
                    history.length
                  }}
                  visits
                </span>

                <BaseButton
                  variant="secondary"
                  size="sm"
                  :disabled="
                    loadingHistory
                  "
                  @click="
                    loadHistory
                  "
                >
                  Refresh
                </BaseButton>
              </div>
            </div>
          </div>


          <div
            v-if="
              loadingHistory
            "
            class="p-10 text-center text-sm text-slate-400"
          >
            Loading clinic history...
          </div>


          <div
            v-else-if="
              history.length
            "
            class="divide-y divide-slate-100"
          >
            <article
              v-for="
                visit in history
              "
              :key="
                visit.clinic_visit_id
              "
              class="p-5"
            >
              <div
                class="flex flex-col justify-between gap-3 sm:flex-row"
              >
                <div>
                  <div
                    class="flex flex-wrap items-center gap-2"
                  >
                    <span
                      class="badge bg-teal-50 text-teal-700"
                    >
                      {{
                        visit.clinic_code
                      }}
                    </span>

                    <span
                      class="badge bg-slate-100 text-slate-600"
                    >
                      {{
                        visit.visit_number
                      }}
                    </span>
                  </div>

                  <h3
                    class="mt-2 font-bold text-slate-900"
                  >
                    {{
                      visit.clinic_name
                    }}
                  </h3>

                  <p
                    class="mt-1 text-sm text-slate-500"
                  >
                    {{
                      visit.specialty ||
                      "Specialty not recorded"
                    }}

                    ·

                    {{
                      visit.doctor_name ||
                      "Doctor not recorded"
                    }}
                  </p>
                </div>

                <div
                  class="text-left text-xs text-slate-400 sm:text-right"
                >
                  {{
                    formatDate(
                      visit.visit_date,
                    )
                  }}
                </div>
              </div>


              <div
                class="mt-4 grid gap-3 md:grid-cols-2"
              >
                <div
                  class="rounded-xl bg-slate-50 p-3"
                >
                  <p
                    class="label"
                  >
                    Reason for visit
                  </p>

                  <p
                    class="mt-1 text-sm text-slate-700"
                  >
                    {{
                      visit.reason_for_visit ||
                      "Not recorded"
                    }}
                  </p>
                </div>


                <div
                  class="rounded-xl bg-slate-50 p-3"
                >
                  <p
                    class="label"
                  >
                    Diagnosis
                  </p>

                  <p
                    class="mt-1 text-sm text-slate-700"
                  >
                    {{
                      visit.diagnosis_summary ||
                      "Not recorded"
                    }}
                  </p>
                </div>
              </div>


              <div
                v-if="
                  visit.clinical_notes
                "
                class="mt-3 rounded-xl border border-slate-200 p-4"
              >
                <p class="label">
                  Clinical notes
                </p>

                <p
                  class="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700"
                >
                  {{
                    visit.clinical_notes
                  }}
                </p>
              </div>


              <div
                v-if="
                  visit.follow_up_required
                "
                class="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3"
              >
                <p
                  class="text-xs font-black uppercase tracking-wider text-amber-700"
                >
                  Follow-up required
                </p>

                <p
                  class="mt-1 text-sm font-semibold text-amber-900"
                >
                  {{
                    visit.follow_up_date
                      ? formatDate(
                          visit.follow_up_date,
                        )
                      : "Date not recorded"
                  }}
                </p>
              </div>
            </article>
          </div>


          <div
            v-else
            class="p-10 text-center text-sm text-slate-400"
          >
            No clinic visits have been recorded for this patient yet.
          </div>
        </section>
      </main>


      <!-- No selected patient -->

      <section
        v-else
        class="card grid place-items-center p-16 text-center"
      >
        <div>
          <div
            class="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-50 text-teal-700"
          >
            <Stethoscope
              :size="26"
            />
          </div>

          <h2
            class="mt-4 font-bold"
          >
            Select a registered patient
          </h2>

          <p
            class="mt-1 text-sm text-slate-400"
          >
            The patient's clinic history will appear here.
          </p>
        </div>
      </section>
    </div>


    <!-- =========================================================
         NEW CLINIC VISIT
         ========================================================= -->

    <Modal
      :open="open"
      title="New specialty clinic visit"
      description="Complete the consultation against the selected patient's existing hospital record."
      @close="
        closeVisitForm
      "
    >
      <form
        v-if="
          selectedPatient &&
          selectedClinic
        "
        class="grid gap-4 sm:grid-cols-2"
        @submit.prevent="
          saveVisit
        "
      >
        <div
          class="sm:col-span-2 rounded-xl bg-teal-50 p-4"
        >
          <p
            class="text-xs font-black uppercase tracking-wider text-teal-700"
          >
            Clinic
          </p>

          <p
            class="mt-1 font-black text-teal-950"
          >
            {{
              selectedClinic.clinic_name
            }}
          </p>

          <p
            class="text-xs text-teal-800"
          >
            {{
              selectedClinic.clinic_code
            }}

            ·

            {{
              selectedClinic.specialty ||
              "Specialty clinic"
            }}
          </p>
        </div>


        <div
          class="sm:col-span-2 rounded-xl bg-slate-50 p-4"
        >
          <p
            class="text-xs font-black uppercase tracking-wider text-slate-400"
          >
            Patient
          </p>

          <p
            class="mt-1 font-bold text-slate-900"
          >
            {{
              selectedPatient.firstName
            }}
            {{
              selectedPatient.lastName
            }}
          </p>

          <p
            class="text-xs text-slate-500"
          >
            {{
              selectedPatient.patientNumber
            }}
          </p>
        </div>


        <FormField
          label="Visit date"
          required
        >
          <BaseInput
            v-model="
              form.visitDate
            "
            type="datetime-local"
            required
            :disabled="
              saving
            "
          />
        </FormField>


        <FormField
          label="Reason for visit"
          required
        >
          <BaseInput
            v-model="
              form.reasonForVisit
            "
            placeholder="Routine review / follow-up complaint"
            required
            :disabled="
              saving
            "
          />
        </FormField>


        <div
          class="sm:col-span-2"
        >
          <FormField
            label="Diagnosis"
            required
          >
            <BaseInput
              v-model="
                form.diagnosisSummary
            "
              placeholder="Clinical diagnosis / assessment"
              required
              :disabled="
                saving
              "
            />
          </FormField>
        </div>


        <div
          class="sm:col-span-2"
        >
          <FormField
            label="Clinical notes"
          >
            <BaseTextarea
              v-model="
                form.clinicalNotes
              "
              rows="6"
              placeholder="History, examination findings, assessment and plan..."
              :disabled="
                saving
              "
            />
          </FormField>
        </div>


        <div
          class="sm:col-span-2 rounded-xl border border-slate-200 p-4"
        >
          <label
            class="flex items-center gap-3 text-sm font-semibold text-slate-700"
          >
            <input
              v-model="
                form.followUpRequired
              "
              type="checkbox"
              class="size-4 rounded border-slate-300 text-teal-600"
              :disabled="
                saving
              "
            />

            Follow-up required
          </label>


          <div
            v-if="
              form.followUpRequired
            "
            class="mt-4"
          >
            <FormField
              label="Follow-up date"
              required
            >
              <BaseInput
                v-model="
                  form.followUpDate
                "
                type="date"
                required
                :disabled="
                  saving
                "
              />
            </FormField>
          </div>
        </div>


        <div
          class="sm:col-span-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500"
        >
          The backend records the authenticated doctor as the consulting clinician. Doctor identity is not taken from the browser form.
        </div>


        <div
          class="sm:col-span-2 flex justify-end gap-2 border-t pt-4"
        >
          <BaseButton
            variant="secondary"
            type="button"
            :disabled="
              saving
            "
            @click="
              closeVisitForm
            "
          >
            Cancel
          </BaseButton>

          <BaseButton
            type="submit"
            :disabled="
              saving ||
              !canSubmit
            "
          >
            {{
              saving
                ? "Saving..."
                : "Complete clinic visit"
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
  reactive,
  ref,
  watch,
} from "vue";

import {
  RouterLink,
} from "vue-router";

import {
  ArrowRight,
  Check,
  Plus,
  Stethoscope,
} from "lucide-vue-next";

import PageHeader
  from "../components/PageHeader.vue";

import Modal
  from "../components/Modal.vue";

import PatientLookup
  from "../components/patient/PatientLookup.vue";

import FormField
  from "../components/forms/FormField.vue";

import BaseButton
  from "../components/ui/BaseButton.vue";

import BaseInput
  from "../components/ui/BaseInput.vue";

import BaseTextarea
  from "../components/ui/BaseTextarea.vue";

import {
  apiGet,
  apiPost,
} from "../services/api";

import {
  useEHR,
} from "../stores/ehr";


interface Clinic {
  clinic_id: number;

  hospital_id: number;

  clinic_code: string;

  clinic_name: string;

  specialty:
    | string
    | null;

  location:
    | string
    | null;

  is_active: boolean;
}


interface ClinicVisit {
  clinic_visit_id: number;

  visit_number: string;

  visit_date: string;

  reason_for_visit:
    | string
    | null;

  clinical_notes:
    | string
    | null;

  diagnosis_summary:
    | string
    | null;

  follow_up_required: boolean;

  follow_up_date:
    | string
    | null;

  status: string;

  clinic_id: number;

  clinic_code: string;

  clinic_name: string;

  specialty:
    | string
    | null;

  location:
    | string
    | null;

  doctor_name:
    | string
    | null;
}


const {
  patients,
} = useEHR();


const selectedPatient =
  ref<any>(null);

const selectedClinic =
  ref<Clinic | null>(
    null,
  );


const clinics =
  ref<Clinic[]>([]);

const history =
  ref<ClinicVisit[]>(
    [],
  );


const loadingClinics =
  ref(false);

const loadingHistory =
  ref(false);

const saving =
  ref(false);


const error =
  ref("");

const open =
  ref(false);


const form =
  reactive({
    visitDate:
      getDefaultDateTime(),

    reasonForVisit:
      "",

    diagnosisSummary:
      "",

    clinicalNotes:
      "",

    followUpRequired:
      false,

    followUpDate:
      "",
  });


const canSubmit =
  computed(() => {
    return (
      !!selectedPatient.value
        ?.id &&

      !!selectedClinic.value
        ?.clinic_id &&

      form.reasonForVisit
        .trim()
        .length > 0 &&

      form.diagnosisSummary
        .trim()
        .length > 0 &&

      (
        !form.followUpRequired ||
        !!form.followUpDate
      )
    );
  });


function getDefaultDateTime() {
  const now =
    new Date();

  const offset =
    now.getTimezoneOffset() *
    60000;

  return new Date(
    now.getTime() -
      offset,
  )
    .toISOString()
    .slice(
      0,
      16,
    );
}


function formatDate(
  value:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return "—";
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
    return value;
  }

  return date.toLocaleString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}


/* ============================================================
   LOAD CLINICS
   ============================================================ */

async function loadClinics() {
  loadingClinics.value =
    true;

  error.value =
    "";

  try {
    const response =
      await apiGet<{
        success: boolean;
        count: number;
        data: Clinic[];
      }>(
        "/clinics",
      );

    clinics.value =
      response.data ||
      [];

    if (
      clinics.value.length &&
      !selectedClinic.value
    ) {
      selectedClinic.value =
        clinics.value[0];
    }
  } catch (err) {
    clinics.value =
      [];

    error.value =
      err instanceof Error
        ? err.message
        : "Unable to load hospital clinics.";
  } finally {
    loadingClinics.value =
      false;
  }
}


/* ============================================================
   SELECT CLINIC
   ============================================================ */

function selectClinic(
  clinic: Clinic,
) {
  selectedClinic.value =
    clinic;

  void loadHistory();
}


/* ============================================================
   LOAD PATIENT CLINIC HISTORY
   ============================================================ */

async function loadHistory() {
  if (
    !selectedPatient.value?.id
  ) {
    history.value =
      [];

    return;
  }

  loadingHistory.value =
    true;

  error.value =
    "";

  try {
    const response =
      await apiGet<{
        success: boolean;
        count: number;
        data: ClinicVisit[];
      }>(
        `/clinics/visits/patient/${Number(
          selectedPatient.value.id,
        )}`,
      );

    history.value =
      response.data ||
      [];
  } catch (err) {
    history.value =
      [];

    error.value =
      err instanceof Error
        ? err.message
        : "Unable to load clinic history.";
  } finally {
    loadingHistory.value =
      false;
  }
}


/* ============================================================
   OPEN FORM
   ============================================================ */

function openVisitForm() {
  if (
    !selectedPatient.value ||
    !selectedClinic.value
  ) {
    return;
  }

  error.value =
    "";

  open.value =
    true;
}


/* ============================================================
   CLOSE FORM
   ============================================================ */

function closeVisitForm() {
  if (saving.value) {
    return;
  }

  open.value =
    false;

  resetForm();
}


/* ============================================================
   RESET FORM
   ============================================================ */

function resetForm() {
  Object.assign(
    form,
    {
      visitDate:
        getDefaultDateTime(),

      reasonForVisit:
        "",

      diagnosisSummary:
        "",

      clinicalNotes:
        "",

      followUpRequired:
        false,

      followUpDate:
        "",
    },
  );
}


/* ============================================================
   SAVE CLINIC VISIT
   ============================================================ */

async function saveVisit() {
  if (
    !canSubmit.value ||
    !selectedPatient.value ||
    !selectedClinic.value
  ) {
    return;
  }

  saving.value =
    true;

  error.value =
    "";

  try {
    await apiPost(
      "/clinics/visits",
      {
        clinicId:
          Number(
            selectedClinic.value
              .clinic_id,
          ),

        patientId:
          Number(
            selectedPatient.value
              .id,
          ),

        visitDate:
          form.visitDate,

        reasonForVisit:
          form.reasonForVisit
            .trim(),

        diagnosisSummary:
          form.diagnosisSummary
            .trim(),

        clinicalNotes:
          form.clinicalNotes
            .trim() ||
          null,

        followUpRequired:
          form.followUpRequired,

        followUpDate:
          form.followUpRequired
            ? form.followUpDate
            : null,
      },
    );

    open.value =
      false;

    resetForm();

    await loadHistory();
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "Unable to save clinic visit.";
  } finally {
    saving.value =
      false;
  }
}


/* ============================================================
   WATCH PATIENT
   ============================================================ */

watch(
  () =>
    selectedPatient.value
      ?.id,

  () => {
    void loadHistory();
  },

  {
    immediate: true,
  },
);


/* ============================================================
   INITIAL LOAD
   ============================================================ */

void loadClinics();
</script>