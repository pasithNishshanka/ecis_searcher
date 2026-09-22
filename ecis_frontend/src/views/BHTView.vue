<template>
  <div>
    <PageHeader
      eyebrow="Inpatient clinical record"
      title="BHT / Inpatient Care"
      description="Maintain the chronological Bed Head Ticket record for admitted patients."
    >
      <BaseButton
        :disabled="
          !selectedAdmission
        "
        @click="
          openEntryForm
        "
      >
        <template #icon>
          <Plus :size="16" />
        </template>

        Add BHT entry
      </BaseButton>
    </PageHeader>


    <div
      v-if="error"
      class="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      {{ error }}
    </div>


    <div
      class="grid gap-6 xl:grid-cols-[340px_1fr]"
    >
      <!-- =====================================================
           PATIENT + ADMISSION
           ===================================================== -->

      <aside class="space-y-5">
        <section class="card p-5">
          <h2
            class="section-title text-base"
          >
            Select patient
          </h2>

          <p class="muted mt-1">
            BHT records are attached to an existing inpatient admission.
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
        </section>


        <section
          v-if="
            selectedPatient
          "
          class="card p-5"
        >
          <div
            class="rounded-xl bg-teal-50 p-4"
          >
            <p
              class="text-xs font-black uppercase tracking-wider text-teal-700"
            >
              Patient
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


          <h3
            class="mt-5 text-sm font-bold"
          >
            Admissions
          </h3>


          <div
            v-if="
              loadingAdmissions
            "
            class="mt-3 text-sm text-slate-400"
          >
            Loading admissions...
          </div>


          <div
            v-else-if="
              admissions.length
            "
            class="mt-3 space-y-2"
          >
            <button
              v-for="
                admission in admissions
              "
              :key="
                admission.id
              "
              type="button"
              class="w-full rounded-xl border p-3 text-left transition"
              :class="
                selectedAdmission?.id ===
                admission.id
                  ? 'border-teal-300 bg-teal-50'
                  : 'border-slate-200 hover:border-teal-200'
              "
              @click="
                selectAdmission(
                  admission,
                )
              "
            >
              <div
                class="flex items-center justify-between gap-2"
              >
                <span
                  class="font-bold text-slate-900"
                >
                  {{
                    admission.admissionNumber
                  }}
                </span>

                <span
                  class="badge"
                  :class="
                    admission.status ===
                    'ADMITTED'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-emerald-100 text-emerald-700'
                  "
                >
                  {{
                    admission.status
                  }}
                </span>
              </div>

              <p
                class="mt-1 text-xs text-slate-500"
              >
                {{
                  admission.wardName ||
                  "Ward"
                }}

                <span
                  v-if="
                    admission.bedNumber
                  "
                >
                  · Bed
                  {{
                    admission.bedNumber
                  }}
                </span>
              </p>

              <p
                class="mt-1 text-[11px] text-slate-400"
              >
                Admitted:
                {{
                  formatDate(
                    admission.admissionDate,
                  )
                }}
              </p>
            </button>
          </div>


          <div
            v-else
            class="mt-3 rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-400"
          >
            No inpatient admissions found.
          </div>
        </section>
      </aside>


      <!-- =====================================================
           BHT TIMELINE
           ===================================================== -->

      <main>
        <section
          v-if="
            selectedAdmission
          "
          class="card overflow-hidden"
        >
          <div
            class="border-b p-5"
          >
            <div
              class="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"
            >
              <div>
                <div
                  class="flex flex-wrap items-center gap-2"
                >
                  <span
                    class="badge bg-teal-50 text-teal-700"
                  >
                    BHT
                  </span>

                  <span
                    class="badge"
                    :class="
                      selectedAdmission.status ===
                      'ADMITTED'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-emerald-100 text-emerald-700'
                    "
                  >
                    {{
                      selectedAdmission.status
                    }}
                  </span>
                </div>

                <h2
                  class="mt-2 section-title"
                >
                  {{
                    selectedAdmission.admissionNumber
                  }}
                </h2>

                <p class="muted">
                  {{
                    selectedAdmission.wardName
                  }}

                  <span
                    v-if="
                      selectedAdmission.bedNumber
                    "
                  >
                    · Bed
                    {{
                      selectedAdmission.bedNumber
                    }}
                  </span>
                </p>
              </div>


              <BaseButton
                variant="secondary"
                size="sm"
                :disabled="
                  loadingEntries
                "
                @click="
                  loadEntries
                "
              >
                Refresh
              </BaseButton>
            </div>


            <div
              class="mt-4 grid gap-2 sm:grid-cols-3"
            >
              <InfoBox
                label="Admission date"
                :value="
                  formatDate(
                    selectedAdmission.admissionDate,
                  )
                "
              />

              <InfoBox
                label="Diagnosis"
                :value="
                  selectedAdmission.admissionDiagnosis ||
                  '—'
                "
              />

              <InfoBox
                label="Doctor"
                :value="
                  selectedAdmission.doctorName ||
                  '—'
                "
              />
            </div>
          </div>


          <div
            v-if="
              loadingEntries
            "
            class="p-10 text-center text-sm text-slate-400"
          >
            Loading BHT timeline...
          </div>


          <div
            v-else-if="
              entries.length
            "
            class="divide-y divide-slate-100"
          >
            <article
              v-for="
                entry in entries
              "
              :key="
                entry.bht_entry_id
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
                        entryTypeLabel(
                          entry.entry_type,
                        )
                      }}
                    </span>

                    <span
                      v-if="
                        entry.entry_title
                      "
                      class="font-bold text-slate-900"
                    >
                      {{
                        entry.entry_title
                      }}
                    </span>
                  </div>

                  <p
                    class="mt-1 text-xs text-slate-400"
                  >
                    {{
                      formatDate(
                        entry.entry_date,
                      )
                    }}

                    ·

                    {{
                      entry.recorded_by_name ||
                      "Doctor not recorded"
                    }}
                  </p>
                </div>
              </div>


              <!-- Vitals -->

              <div
                v-if="
                  hasVitals(
                    entry,
                  )
                "
                class="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-4"
              >
                <Vital
                  label="Temp"
                  :value="
                    entry.temperature_c != null
                      ? `${entry.temperature_c} °C`
                      : '—'
                  "
                />

                <Vital
                  label="Pulse"
                  :value="
                    entry.pulse_bpm != null
                      ? `${entry.pulse_bpm} bpm`
                      : '—'
                  "
                />

                <Vital
                  label="Respiratory"
                  :value="
                    entry.respiratory_rate_bpm != null
                      ? `${entry.respiratory_rate_bpm} /min`
                      : '—'
                  "
                />

                <Vital
                  label="BP"
                  :value="
                    entry.systolic_bp != null &&
                    entry.diastolic_bp != null
                      ? `${entry.systolic_bp}/${entry.diastolic_bp}`
                      : '—'
                  "
                />

                <Vital
                  label="SpO₂"
                  :value="
                    entry.spo2_percent != null
                      ? `${entry.spo2_percent}%`
                      : '—'
                  "
                />

                <Vital
                  label="Pain"
                  :value="
                    entry.pain_score != null
                      ? `${entry.pain_score}/10`
                      : '—'
                  "
                />

                <Vital
                  label="Weight"
                  :value="
                    entry.weight_kg != null
                      ? `${entry.weight_kg} kg`
                      : '—'
                  "
                />
              </div>


              <!-- Clinical notes -->

              <div
                class="mt-4 grid gap-3 md:grid-cols-2"
              >
                <NoteBlock
                  v-if="
                    entry.subjective_notes
                  "
                  label="Subjective"
                  :value="
                    entry.subjective_notes
                  "
                />

                <NoteBlock
                  v-if="
                    entry.objective_notes
                  "
                  label="Objective"
                  :value="
                    entry.objective_notes
                  "
                />

                <NoteBlock
                  v-if="
                    entry.assessment
                  "
                  label="Assessment"
                  :value="
                    entry.assessment
                  "
                />

                <NoteBlock
                  v-if="
                    entry.plan
                  "
                  label="Plan"
                  :value="
                    entry.plan
                  "
                />

                <NoteBlock
                  v-if="
                    entry.diagnosis
                  "
                  label="Diagnosis"
                  :value="
                    entry.diagnosis
                  "
                />
              </div>
            </article>
          </div>


          <div
            v-else
            class="p-12 text-center"
          >
            <div
              class="mx-auto grid size-12 place-items-center rounded-2xl bg-teal-50 text-teal-700"
            >
              <ClipboardPlus
                :size="24"
              />
            </div>

            <h3
              class="mt-4 font-bold"
            >
              No BHT entries yet
            </h3>

            <p
              class="mt-1 text-sm text-slate-400"
            >
              Record the admission assessment or first ward round to begin the BHT timeline.
            </p>
          </div>
        </section>


        <section
          v-else
          class="card grid place-items-center p-16 text-center"
        >
          <div>
            <div
              class="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-50 text-teal-700"
            >
              <ClipboardPlus
                :size="28"
              />
            </div>

            <h2
              class="mt-4 font-bold"
            >
              Select an inpatient admission
            </h2>

            <p
              class="mt-1 text-sm text-slate-400"
            >
              The patient's BHT timeline will appear here.
            </p>
          </div>
        </section>
      </main>
    </div>


    <!-- =====================================================
         NEW BHT ENTRY
         ===================================================== -->

    <Modal
      :open="
        entryFormOpen
      "
      title="New BHT clinical entry"
      description="Record a chronological inpatient clinical entry for the selected admission."
      @close="
        closeEntryForm
      "
    >
      <form
        class="grid gap-4 sm:grid-cols-2"
        @submit.prevent="
          saveEntry
        "
      >
        <div
          class="sm:col-span-2 rounded-xl bg-teal-50 p-4"
        >
          <p
            class="text-xs font-black uppercase tracking-wider text-teal-700"
          >
            Admission
          </p>

          <p
            class="mt-1 font-black text-teal-950"
          >
            {{
              selectedAdmission?.admissionNumber
            }}
          </p>

          <p
            class="text-xs text-teal-800"
          >
            {{
              selectedAdmission?.wardName
            }}

            <span
              v-if="
                selectedAdmission?.bedNumber
              "
            >
              · Bed
              {{
                selectedAdmission.bedNumber
              }}
            </span>
          </p>
        </div>


        <FormField
          label="Entry type"
          required
        >
          <BaseSelect
            v-model="
              form.entryType
            "
            required
            :disabled="
              saving
            "
          >
            <option
              value="ADMISSION_ASSESSMENT"
            >
              Admission assessment
            </option>

            <option
              value="DAILY_PROGRESS"
            >
              Daily progress
            </option>

            <option
              value="WARD_ROUND"
            >
              Ward round
            </option>

            <option
              value="CONSULTATION"
            >
              Clinical consultation
            </option>

            <option
              value="PROCEDURE_NOTE"
            >
              Procedure note
            </option>

            <option
              value="DISCHARGE_PLANNING"
            >
              Discharge planning
            </option>
          </BaseSelect>
        </FormField>


        <FormField
          label="Entry date"
          required
        >
          <BaseInput
            v-model="
              form.entryDate
            "
            type="datetime-local"
            required
            :disabled="
              saving
            "
          />
        </FormField>


        <div
          class="sm:col-span-2"
        >
          <FormField label="Entry title">
            <BaseInput
              v-model="
                form.entryTitle
              "
              placeholder="Morning ward round"
              :disabled="
                saving
              "
            />
          </FormField>
        </div>


        <div
          class="sm:col-span-2"
        >
          <FormField label="Diagnosis">
            <BaseInput
              v-model="
                form.diagnosis
              "
              placeholder="Current diagnosis / working diagnosis"
              :disabled="
                saving
              "
            />
          </FormField>
        </div>


        <!-- Vitals -->

        <div
          class="sm:col-span-2"
        >
          <p
            class="mb-2 text-xs font-black uppercase tracking-wider text-slate-400"
          >
            Observations
          </p>
        </div>


        <FormField label="Temperature °C">
          <BaseInput
            v-model="
              form.temperatureC
            "
            type="number"
            step="0.1"
            min="20"
            max="45"
            placeholder="37.0"
            :disabled="
              saving
            "
          />
        </FormField>


        <FormField label="Pulse bpm">
          <BaseInput
            v-model="
              form.pulseBpm
            "
            type="number"
            min="20"
            max="300"
            placeholder="80"
            :disabled="
              saving
            "
          />
        </FormField>


        <FormField label="Respiratory rate /min">
          <BaseInput
            v-model="
              form.respiratoryRateBpm
            "
            type="number"
            min="1"
            max="100"
            placeholder="18"
            :disabled="
              saving
            "
          />
        </FormField>


        <FormField label="SpO₂ %">
          <BaseInput
            v-model="
              form.spo2Percent
            "
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="98"
            :disabled="
              saving
            "
          />
        </FormField>


        <FormField label="Systolic BP">
          <BaseInput
            v-model="
              form.systolicBp
            "
            type="number"
            min="40"
            max="300"
            placeholder="120"
            :disabled="
              saving
            "
          />
        </FormField>


        <FormField label="Diastolic BP">
          <BaseInput
            v-model="
              form.diastolicBp
            "
            type="number"
            min="20"
            max="200"
            placeholder="80"
            :disabled="
              saving
            "
          />
        </FormField>


        <FormField label="Pain score /10">
          <BaseInput
            v-model="
              form.painScore
            "
            type="number"
            min="0"
            max="10"
            placeholder="0"
            :disabled="
              saving
            "
          />
        </FormField>


        <FormField label="Weight kg">
          <BaseInput
            v-model="
              form.weightKg
            "
            type="number"
            min="0"
            max="500"
            step="0.1"
            placeholder="65"
            :disabled="
              saving
            "
          />
        </FormField>


        <!-- Notes -->

        <div
          class="sm:col-span-2"
        >
          <FormField label="Subjective">
            <BaseTextarea
              v-model="
                form.subjectiveNotes
              "
              rows="4"
              placeholder="Patient-reported symptoms and concerns..."
              :disabled="
                saving
              "
            />
          </FormField>
        </div>


        <div
          class="sm:col-span-2"
        >
          <FormField label="Objective">
            <BaseTextarea
              v-model="
                form.objectiveNotes
              "
              rows="4"
              placeholder="Examination findings and observed clinical status..."
              :disabled="
                saving
              "
            />
          </FormField>
        </div>


        <div
          class="sm:col-span-2"
        >
          <FormField label="Assessment">
            <BaseTextarea
              v-model="
                form.assessment
              "
              rows="4"
              placeholder="Clinical assessment and interpretation..."
              :disabled="
                saving
              "
            />
          </FormField>
        </div>


        <div
          class="sm:col-span-2"
        >
          <FormField label="Plan">
            <BaseTextarea
              v-model="
                form.plan
              "
              rows="4"
              placeholder="Treatment plan, monitoring, investigations or next steps..."
              :disabled="
                saving
              "
            />
          </FormField>
        </div>


        <div
          class="sm:col-span-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500"
        >
          The authenticated doctor is recorded by the backend. The browser cannot select another hospital user as the recorder.
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
              closeEntryForm
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
                : "Save BHT entry"
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
  ClipboardPlus,
  Plus,
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

import BaseSelect
  from "../components/ui/BaseSelect.vue";

import BaseTextarea
  from "../components/ui/BaseTextarea.vue";

import {
  apiGet,
  apiPost,
} from "../services/api";

import {
  useEHR,
} from "../stores/ehr";


const InfoBox = {
  props: [
    "label",
    "value",
  ],

  template: `
    <div class="rounded-xl bg-slate-50 p-3">
      <p class="label">
        {{ label }}
      </p>

      <p class="mt-1 text-sm font-bold">
        {{ value || "—" }}
      </p>
    </div>
  `,
};


const Vital = {
  props: [
    "label",
    "value",
  ],

  template: `
    <div class="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p class="text-[10px] font-black uppercase tracking-wider text-slate-400">
        {{ label }}
      </p>

      <p class="mt-1 text-sm font-bold text-slate-800">
        {{ value }}
      </p>
    </div>
  `,
};


const NoteBlock = {
  props: [
    "label",
    "value",
  ],

  template: `
    <div class="rounded-xl bg-slate-50 p-4">
      <p class="label">
        {{ label }}
      </p>

      <p class="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
        {{ value }}
      </p>
    </div>
  `,
};


const {
  patients,
  getPatientAdmissions,
} =
  useEHR();


const selectedPatient =
  ref<any>(null);

const selectedAdmission =
  ref<any>(null);


const admissions =
  ref<any[]>([]);

const entries =
  ref<any[]>([]);


const loadingAdmissions =
  ref(false);

const loadingEntries =
  ref(false);

const saving =
  ref(false);

const error =
  ref("");


const entryFormOpen =
  ref(false);


const form =
  reactive({
    entryType:
      "DAILY_PROGRESS",

    entryDate:
      getDefaultDateTime(),

    entryTitle:
      "",

    diagnosis:
      "",

    temperatureC:
      "",

    pulseBpm:
      "",

    respiratoryRateBpm:
      "",

    systolicBp:
      "",

    diastolicBp:
      "",

    spo2Percent:
      "",

    painScore:
      "",

    weightKg:
      "",

    subjectiveNotes:
      "",

    objectiveNotes:
      "",

    assessment:
      "",

    plan:
      "",
  });


const canSubmit =
  computed(() => {
    return (
      !!selectedAdmission.value
        ?.id &&
      (
        form.diagnosis.trim() ||
        form.subjectiveNotes.trim() ||
        form.objectiveNotes.trim() ||
        form.assessment.trim() ||
        form.plan.trim()
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


/* ============================================================
   DISPLAY HELPERS
   ============================================================ */

function entryTypeLabel(
  type: string,
): string {
  const labels: Record<
    string,
    string
  > = {
    ADMISSION_ASSESSMENT:
      "Admission assessment",

    DAILY_PROGRESS:
      "Daily progress",

    WARD_ROUND:
      "Ward round",

    CONSULTATION:
      "Clinical consultation",

    PROCEDURE_NOTE:
      "Procedure note",

    DISCHARGE_PLANNING:
      "Discharge planning",
  };

  if (
    labels[type]
  ) {
    return labels[type];
  }

  return type
    .replaceAll(
      "_",
      " ",
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}


function hasVitals(
  entry: any,
): boolean {
  return [
    entry.temperature_c,
    entry.pulse_bpm,
    entry.respiratory_rate_bpm,
    entry.systolic_bp,
    entry.diastolic_bp,
    entry.spo2_percent,
    entry.pain_score,
    entry.weight_kg,
  ].some(
    (value) =>
      value !== null &&
      value !== undefined &&
      value !== "",
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
    new Date(value);

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
   ADMISSIONS
   ============================================================ */

async function loadAdmissions() {
  if (
    !selectedPatient.value?.id
  ) {
    admissions.value =
      [];

    selectedAdmission.value =
      null;

    entries.value =
      [];

    return;
  }

  loadingAdmissions.value =
    true;

  error.value =
    "";

  try {
    admissions.value =
      await getPatientAdmissions(
        selectedPatient.value.id,
      );


    const activeAdmission =
      admissions.value.find(
        (admission) =>
          admission.status ===
          "ADMITTED",
      );


    if (
      activeAdmission
    ) {
      await selectAdmission(
        activeAdmission,
      );
    } else {
      selectedAdmission.value =
        admissions.value[0] ||
        null;

      if (
        selectedAdmission.value
      ) {
        await loadEntries();
      } else {
        entries.value =
          [];
      }
    }
  } catch (err) {
    admissions.value =
      [];

    selectedAdmission.value =
      null;

    entries.value =
      [];

    error.value =
      err instanceof Error
        ? err.message
        : "Unable to load patient admissions.";
  } finally {
    loadingAdmissions.value =
      false;
  }
}


async function selectAdmission(
  admission: any,
) {
  selectedAdmission.value =
    admission;

  await loadEntries();
}


/* ============================================================
   BHT ENTRIES
   ============================================================ */

async function loadEntries() {
  if (
    !selectedAdmission.value?.id
  ) {
    entries.value =
      [];

    return;
  }

  loadingEntries.value =
    true;

  error.value =
    "";

  try {
    const response =
      await apiGet<{
        success: boolean;
        count: number;
        data: any[];
      }>(
        `/bht/admissions/${Number(
          selectedAdmission.value.id,
        )}/entries`,
      );

    entries.value =
      response.data ||
      [];
  } catch (err) {
    entries.value =
      [];

    error.value =
      err instanceof Error
        ? err.message
        : "Unable to load BHT entries.";
  } finally {
    loadingEntries.value =
      false;
  }
}


/* ============================================================
   FORM
   ============================================================ */

function openEntryForm() {
  if (
    !selectedAdmission.value
  ) {
    return;
  }

  if (
    selectedAdmission.value.status !==
    "ADMITTED"
  ) {
    error.value =
      "BHT entries can only be added while the admission is active.";

    return;
  }

  error.value =
    "";

  entryFormOpen.value =
    true;
}


function closeEntryForm() {
  if (saving.value) {
    return;
  }

  entryFormOpen.value =
    false;

  resetForm();
}


function resetForm() {
  Object.assign(
    form,
    {
      entryType:
        "DAILY_PROGRESS",

      entryDate:
        getDefaultDateTime(),

      entryTitle:
        "",

      diagnosis:
        "",

      temperatureC:
        "",

      pulseBpm:
        "",

      respiratoryRateBpm:
        "",

      systolicBp:
        "",

      diastolicBp:
        "",

      spo2Percent:
        "",

      painScore:
        "",

      weightKg:
        "",

      subjectiveNotes:
        "",

      objectiveNotes:
        "",

      assessment:
        "",

      plan:
        "",
    },
  );
}


/* ============================================================
   SAVE
   ============================================================ */

async function saveEntry() {
  if (
    !canSubmit.value ||
    !selectedAdmission.value
  ) {
    return;
  }

  saving.value =
    true;

  error.value =
    "";

  try {
    await apiPost(
      `/bht/admissions/${Number(
        selectedAdmission.value.id,
      )}/entries`,
      {
        entryType:
          form.entryType,

        entryDate:
          form.entryDate,

        entryTitle:
          form.entryTitle.trim() ||
          null,

        diagnosis:
          form.diagnosis.trim() ||
          null,

        temperatureC:
          form.temperatureC ||
          null,

        pulseBpm:
          form.pulseBpm ||
          null,

        respiratoryRateBpm:
          form.respiratoryRateBpm ||
          null,

        systolicBp:
          form.systolicBp ||
          null,

        diastolicBp:
          form.diastolicBp ||
          null,

        spo2Percent:
          form.spo2Percent ||
          null,

        painScore:
          form.painScore ||
          null,

        weightKg:
          form.weightKg ||
          null,

        subjectiveNotes:
          form.subjectiveNotes.trim() ||
          null,

        objectiveNotes:
          form.objectiveNotes.trim() ||
          null,

        assessment:
          form.assessment.trim() ||
          null,

        plan:
          form.plan.trim() ||
          null,
      },
    );

    entryFormOpen.value =
      false;

    resetForm();

    await loadEntries();
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "Unable to save BHT entry.";
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
    selectedPatient.value?.id,

  () => {
    void loadAdmissions();
  },
);


/* ============================================================
   INIT
   ============================================================ */
</script>