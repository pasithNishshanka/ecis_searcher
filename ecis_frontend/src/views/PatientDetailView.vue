<template>
  <div v-if="patient">
    <PageHeader
      eyebrow="Patient EHR"
      :title="`${patient.firstName} ${patient.lastName}`"
      :description="`${patient.patientNumber} · Longitudinal clinical record`"
    >
      <BaseButton
        @click="
          openTreatment = true
        "
      >
        Add clinical record
      </BaseButton>
    </PageHeader>


    <div class="grid gap-6 xl:grid-cols-[320px_1fr]">
      <!-- =================================================
           LEFT
           ================================================= -->

      <aside class="space-y-4">
        <!-- Patient summary -->

        <div class="card p-5">
          <div class="flex gap-3">
            <div class="avatar">
              {{
                patient.firstName?.[0] ||
                ""
              }}{{
                patient.lastName?.[0] ||
                ""
              }}
            </div>

            <div>
              <b>
                {{
                  patient.firstName
                }}
                {{
                  patient.lastName
                }}
              </b>

              <p class="text-xs text-slate-400">
                {{
                  patient.patientNumber
                }}
              </p>
            </div>
          </div>


          <div class="mt-5 grid grid-cols-2 gap-2">
            <Info
              l="DOB"
              :v="patient.dateOfBirth"
            />

            <Info
              l="Age"
              :v="`${age} years`"
            />

            <Info
              l="Blood"
              :v="
                patient.bloodGroup ||
                '—'
              "
            />

            <Info
              l="Gender"
              :v="
                patient.gender ||
                '—'
              "
            />

            <Info
              l="Height"
              :v="
                patient.heightCm
                  ? `${patient.heightCm} cm`
                  : '—'
              "
            />

            <Info
              l="Weight"
              :v="
                patient.weightKg
                  ? `${patient.weightKg} kg`
                  : '—'
              "
            />

            <Info
              l="Province"
              :v="
                patient.province ||
                '—'
              "
            />

            <Info
              l="District"
              :v="
                patient.district ||
                '—'
              "
            />
          </div>


          <!-- Address -->

          <div class="mt-3 rounded-xl bg-slate-50 p-3">
            <p class="label">
              Address
            </p>

            <p class="text-sm">
              {{
                patient.address ||
                "Not recorded"
              }}
            </p>
          </div>


          <!-- Workplace -->

          <div class="mt-3 rounded-xl bg-slate-50 p-3">
            <p class="label">
              Workplace
            </p>

            <p class="text-sm">
              {{
                patient.workplace ||
                "Not recorded"
              }}
            </p>
          </div>
        </div>


        <!-- Allergies -->

        <div
          class="rounded-2xl border border-amber-200 bg-amber-50 p-5"
        >
          <p class="font-bold text-amber-900">
            Allergy information
          </p>


          <div class="mt-4 space-y-4">
            <!-- Food -->

            <div>
              <p
                class="text-xs font-bold uppercase tracking-wide text-amber-700"
              >
                Food allergies
              </p>


              <div
                v-if="
                  patient.foodAllergies
                    ?.length
                "
                class="mt-2 flex flex-wrap gap-2"
              >
                <span
                  v-for="
                    allergy in patient.foodAllergies
                  "
                  :key="
                    `food-${allergy}`
                  "
                  class="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-900"
                >
                  {{
                    allergy
                  }}
                </span>
              </div>


              <p
                v-else
                class="mt-1 text-sm text-amber-800"
              >
                None recorded
              </p>
            </div>


            <!-- Medical -->

            <div>
              <p
                class="text-xs font-bold uppercase tracking-wide text-amber-700"
              >
                Medical / drug allergies
              </p>


              <div
                v-if="
                  patient.medicalAllergies
                    ?.length
                "
                class="mt-2 flex flex-wrap gap-2"
              >
                <span
                  v-for="
                    allergy in patient.medicalAllergies
                  "
                  :key="
                    `medical-${allergy}`
                  "
                  class="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-900"
                >
                  {{
                    allergy
                  }}
                </span>
              </div>


              <p
                v-else
                class="mt-1 text-sm text-amber-800"
              >
                None recorded
              </p>
            </div>
          </div>
        </div>


        <!-- Registration notes -->

        <div
          v-if="
            patient.registrationNotes
          "
          class="rounded-2xl bg-slate-50 p-5"
        >
          <p class="font-bold text-slate-900">
            Registration notes
          </p>

          <p
            class="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600"
          >
            {{
              patient.registrationNotes
            }}
          </p>
        </div>


        <!-- AI -->

        <RouterLink to="/medical">
          <BaseButton
            variant="secondary"
            block
          >
            Open AI summary
          </BaseButton>
        </RouterLink>
      </aside>


      <!-- =================================================
           RIGHT
           ================================================= -->

      <section
        class="card overflow-hidden"
      >
        <!-- =================================================
             INPATIENT ADMISSION HISTORY
             ================================================= -->

        <div class="border-b p-5">
          <div
            class="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"
          >
            <div>
              <h2 class="section-title">
                Inpatient admission history
              </h2>

              <p class="muted mt-1">
                Previous and current inpatient admissions remain part of the patient's longitudinal EHR, including discharge details.
              </p>
            </div>

            <BaseButton
              variant="secondary"
              size="sm"
              :loading="
                admissionLoading
              "
              @click="
                loadAdmissionHistory
              "
            >
              Refresh
            </BaseButton>
          </div>
        </div>


        <!-- Admission error -->

        <div
          v-if="
            admissionError
          "
          class="border-b border-red-100 bg-red-50 p-5 text-sm text-red-700"
        >
          {{
            admissionError
          }}
        </div>


        <!-- Loading -->

        <div
          v-else-if="
            admissionLoading
          "
          class="border-b p-8 text-center text-sm text-slate-400"
        >
          Loading inpatient admission history...
        </div>


        <!-- Admissions -->

        <div
          v-else-if="
            admissions.length
          "
          class="divide-y divide-slate-100 border-b"
        >
          <article
            v-for="
              admission in admissions
            "
            :key="
              admission.id
            "
            class="p-5"
          >
            <div
              class="flex flex-col justify-between gap-3 lg:flex-row lg:items-start"
            >
              <!-- Admission identification -->

              <div>
                <div
                  class="flex flex-wrap items-center gap-2"
                >
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

                  <span
                    class="badge bg-slate-100 text-slate-600"
                  >
                    {{
                      admission.admissionNumber ||
                      "Admission record"
                    }}
                  </span>
                </div>


                <h3
                  class="mt-3 font-bold text-slate-900"
                >
                  {{
                    admission.wardName ||
                    "Ward not recorded"
                  }}
                </h3>


                <p
                  class="mt-1 text-sm text-slate-500"
                >
                  {{
                    admission.wardCode ||
                    "—"
                  }}

                  <span
                    v-if="
                      admission.wardType
                    "
                  >
                    ·
                    {{
                      admission.wardType
                    }}
                  </span>

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
              </div>


              <!-- Dates -->

              <div
                class="text-left text-sm lg:text-right"
              >
                <p
                  class="text-xs font-bold uppercase tracking-wider text-slate-400"
                >
                  Admission date
                </p>

                <p
                  class="font-semibold text-slate-700"
                >
                  {{
                    formatDateTime(
                      admission.admissionDate,
                    )
                  }}
                </p>


                <p
                  class="mt-2 text-xs font-bold uppercase tracking-wider text-slate-400"
                >
                  Discharge date
                </p>

                <p
                  class="font-semibold text-slate-700"
                >
                  {{
                    formatDateTime(
                      admission.dischargeDate,
                    )
                  }}
                </p>
              </div>
            </div>


            <!-- Admission details -->

            <div
              class="mt-4 grid gap-3 md:grid-cols-2"
            >
              <div
                class="rounded-xl bg-slate-50 p-3"
              >
                <p class="label">
                  Admission diagnosis
                </p>

                <p
                  class="mt-1 text-sm text-slate-700"
                >
                  {{
                    admission.admissionDiagnosis ||
                    "Not recorded"
                  }}
                </p>
              </div>


              <div
                class="rounded-xl bg-slate-50 p-3"
              >
                <p class="label">
                  Admission reason
                </p>

                <p
                  class="mt-1 text-sm text-slate-700"
                >
                  {{
                    admission.admissionReason ||
                    "Not recorded"
                  }}
                </p>
              </div>


              <!-- Discharge diagnosis -->

              <div
                v-if="
                  admission.dischargeDiagnosis
                "
                class="rounded-xl bg-emerald-50 p-3"
              >
                <p
                  class="label text-emerald-700"
                >
                  Discharge diagnosis
                </p>

                <p
                  class="mt-1 text-sm text-emerald-900"
                >
                  {{
                    admission.dischargeDiagnosis
                  }}
                </p>
              </div>


              <!-- Doctor -->

              <div
                v-if="
                  admission.doctorName
                "
                class="rounded-xl bg-slate-50 p-3"
              >
                <p class="label">
                  Attending doctor
                </p>

                <p
                  class="mt-1 text-sm text-slate-700"
                >
                  {{
                    admission.doctorName
                  }}
                </p>
              </div>
            </div>


            <!-- Discharge summary -->

            <div
              v-if="
                admission.dischargeSummary
              "
              class="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4"
            >
              <p
                class="label text-emerald-700"
              >
                Discharge summary
              </p>

              <p
                class="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700"
              >
                {{
                  admission.dischargeSummary
                }}
              </p>
            </div>
          </article>
        </div>


        <!-- Empty -->

        <div
          v-else
          class="border-b p-8 text-center text-sm text-slate-400"
        >
          No inpatient admission records yet.
        </div>


        <!-- =================================================
             LONGITUDINAL SOURCE EVIDENCE
             ================================================= -->

        <div class="border-b p-5">
          <div
            class="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"
          >
            <div>
              <h2 class="section-title">
                Longitudinal source evidence
              </h2>

              <p class="muted mt-1">
                Existing clinical records that support ECIS review are shown below. These records are read from the patient's EHR and are not copied into a separate ECIS patient database.
              </p>
            </div>

            <BaseButton
              variant="secondary"
              size="sm"
              :loading="evidenceLoading"
              @click="loadEvidence"
            >
              Refresh evidence
            </BaseButton>
          </div>
        </div>

        <div
          v-if="evidenceError"
          class="border-b border-red-100 bg-red-50 p-5 text-sm text-red-700"
        >
          {{ evidenceError }}
        </div>

        <div
          v-else-if="evidenceLoading"
          class="border-b p-8 text-center text-sm text-slate-400"
        >
          Loading source clinical evidence...
        </div>

        <div
          v-else
          class="border-b p-5"
        >
          <div
            class="mb-4 flex flex-wrap gap-2"
          >
            <span
              v-for="section in evidenceSections"
              :key="section.key"
              class="badge bg-slate-100 text-slate-600"
            >
              {{ section.label }} · {{ section.rows.length }}
            </span>
          </div>

          <div
            class="grid gap-4 lg:grid-cols-2"
          >
            <div
              v-for="section in evidenceSections"
              :key="`evidence-${section.key}`"
              class="rounded-2xl border border-slate-100 bg-white p-4"
            >
              <div
                class="flex items-center justify-between gap-3"
              >
                <div>
                  <h3 class="font-bold text-slate-900">
                    {{ section.label }}
                  </h3>

                  <p class="mt-1 text-xs text-slate-400">
                    {{ section.rows.length }} record(s)
                  </p>
                </div>

                <span class="badge">
                  EHR
                </span>
              </div>

              <div
                v-if="section.rows.length"
                class="mt-3 space-y-2"
              >
                <details
                  v-for="row in section.rows"
                  :key="row.key"
                  class="rounded-xl bg-slate-50 p-3"
                >
                  <summary
                    class="cursor-pointer list-none"
                  >
                    <div
                      class="flex flex-col justify-between gap-1 sm:flex-row sm:items-start"
                    >
                      <div class="min-w-0">
                        <p class="font-semibold text-slate-800">
                          {{ row.title }}
                        </p>

                        <p
                          v-if="row.subtitle"
                          class="mt-1 text-xs text-slate-500"
                        >
                          {{ row.subtitle }}
                        </p>
                      </div>

                      <span
                        class="shrink-0 text-xs text-slate-400"
                      >
                        {{ row.date || "—" }}
                      </span>
                    </div>
                  </summary>

                  <div
                    v-if="row.details.length"
                    class="mt-3 grid gap-2 sm:grid-cols-2"
                  >
                    <div
                      v-for="detail in row.details"
                      :key="detail.label"
                      class="rounded-lg bg-white p-2.5"
                    >
                      <p class="label">
                        {{ detail.label }}
                      </p>

                      <p
                        class="mt-1 whitespace-pre-line text-xs leading-5 text-slate-600"
                      >
                        {{ detail.value }}
                      </p>
                    </div>
                  </div>
                </details>
              </div>

              <div
                v-else
                class="mt-3 rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-400"
              >
                No records in this source.
              </div>
            </div>
          </div>
        </div>


        <!-- =================================================
             TREATMENT HISTORY
             ================================================= -->

        <div class="border-b p-5">
          <h2 class="section-title">
            Treatment history
          </h2>

          <p class="muted mt-1">
            OPD, ward, surgery, procedures, imaging and emergency records remain linked to this patient.
          </p>
        </div>


        <div
          class="divide-y divide-slate-100"
        >
          <article
            v-for="
              t in records
            "
            :key="
              t.id
            "
            class="p-5"
          >
            <div
              class="flex flex-col justify-between gap-2 sm:flex-row"
            >
              <div>
                <span class="badge">
                  {{
                    t.type
                  }}
                </span>

                <h3
                  class="mt-2 font-bold"
                >
                  {{
                    t.treatment ||
                    "Clinical record"
                  }}
                </h3>

                <p
                  class="text-sm text-slate-500"
                >
                  {{
                    t.diagnosis ||
                    "No diagnosis recorded"
                  }}
                </p>
              </div>


              <span
                class="text-xs text-slate-400"
              >
                {{
                  t.date
                }}
              </span>
            </div>


            <div
              class="mt-3 grid gap-2 sm:grid-cols-2"
            >
              <p
                class="text-sm text-slate-600"
              >
                <b>
                  Department:
                </b>

                {{
                  t.department ||
                  "—"
                }}
              </p>


              <p
                class="text-sm text-slate-600"
              >
                <b>
                  Doctor:
                </b>

                {{
                  t.doctor ||
                  "—"
                }}
              </p>


              <p
                v-if="
                  t.bodyRegion
                "
                class="text-sm text-slate-600"
              >
                <b>
                  Body region:
                </b>

                {{
                  t.bodyRegion
                }}
              </p>


              <p
                v-if="
                  t.clinicalFinding
                "
                class="text-sm text-slate-600"
              >
                <b>
                  Finding:
                </b>

                {{
                  t.clinicalFinding
                }}
              </p>


              <p
                v-if="
                  t.implant
                "
                class="text-sm text-slate-600"
              >
                <b>
                  Implant:
                </b>

                {{
                  t.implant
                }}

                {{
                  t.implantSerial
                    ? `· ${t.implantSerial}`
                    : ""
                }}
              </p>


              <p
                v-if="
                  t.scar
                "
                class="text-sm text-slate-600"
              >
                <b>
                  Scar:
                </b>

                {{
                  t.scar
                }}
              </p>


              <p
                v-if="
                  t.oldFracture
                "
                class="text-sm text-slate-600"
              >
                <b>
                  Old fracture:
                </b>

                {{
                  t.oldFracture
                }}
              </p>


              <p
                v-if="
                  t.birthmark
                "
                class="text-sm text-slate-600"
              >
                <b>
                  Birthmark:
                </b>

                {{
                  t.birthmark
                }}
              </p>


              <p
                v-if="
                  t.tattoo
                "
                class="text-sm text-slate-600"
              >
                <b>
                  Tattoo:
                </b>

                {{
                  t.tattoo
                }}
              </p>


              <p
                v-if="
                  t.missingBodyPart
                "
                class="text-sm text-slate-600"
              >
                <b>
                  Missing body part:
                </b>

                {{
                  t.missingBodyPart
                }}
              </p>
            </div>


            <p
              v-if="t.notes"
              class="mt-3 text-sm leading-6 text-slate-600"
            >
              {{
                t.notes
              }}
            </p>
          </article>


          <div
            v-if="
              !records.length
            "
            class="p-10 text-center text-sm text-slate-400"
          >
            No treatment records yet.
          </div>
        </div>
      </section>
    </div>


    <!-- ===================================================
         ADD CLINICAL RECORD MODAL
         =================================================== -->

    <Modal
      :open="
        openTreatment
      "
      title="Add clinical record"
      description="This is how a later surgery, procedure, scar, implant or other finding becomes searchable by ECIS."
      @close="
        openTreatment = false
      "
    >
      <form
        @submit.prevent="
          save
        "
        class="grid gap-4 sm:grid-cols-2"
      >
        <FormField label="Record type">
          <BaseSelect
            v-model="t.type"
          >
            <option>
              OPD
            </option>

            <option>
              WARD
            </option>

            <option>
              SURGERY
            </option>

            <option>
              PROCEDURE
            </option>

            <option>
              LAB
            </option>

            <option>
              IMAGING
            </option>

            <option>
              EMERGENCY
            </option>
          </BaseSelect>
        </FormField>


        <FormField
          label="Date"
          required
        >
          <BaseInput
            v-model="t.date"
            type="date"
            required
          />
        </FormField>


        <FormField
          label="Department"
          required
        >
          <BaseInput
            v-model="
              t.department
            "
            required
          />
        </FormField>


        <FormField label="Doctor">
          <BaseInput
            v-model="
              t.doctor
            "
          />
        </FormField>


        <div
          class="sm:col-span-2"
        >
          <FormField label="Diagnosis">
            <BaseInput
              v-model="
                t.diagnosis
              "
            />
          </FormField>
        </div>


        <div
          class="sm:col-span-2"
        >
          <FormField
            label="Treatment / procedure"
            required
          >
            <BaseInput
              v-model="
                t.treatment
              "
              required
            />
          </FormField>
        </div>


        <FormField label="Body region">
          <BaseSelect
            v-model="
              t.bodyRegion
            "
          >
            <option value="">
              Not specified
            </option>

            <option>
              Right arm
            </option>

            <option>
              Left arm
            </option>

            <option>
              Right leg
            </option>

            <option>
              Left leg
            </option>

            <option>
              Chest
            </option>

            <option>
              Abdomen
            </option>

            <option>
              Head/face
            </option>
          </BaseSelect>
        </FormField>


        <FormField label="Clinical finding">
          <BaseInput
            v-model="
              t.clinicalFinding
            "
            placeholder="Surgical scar, birthmark..."
          />
        </FormField>


        <FormField label="Implant / device">
          <BaseInput
            v-model="
              t.implant
            "
            placeholder="Pacemaker, orthopedic plate"
          />
        </FormField>


        <FormField label="Implant serial number">
          <BaseInput
            v-model="
              t.implantSerial
            "
          />
        </FormField>


        <FormField label="Surgical scar">
          <BaseInput
            v-model="
              t.scar
            "
            placeholder="Right arm surgical scar"
          />
        </FormField>


        <FormField label="Old fracture">
          <BaseInput
            v-model="
              t.oldFracture
            "
          />
        </FormField>


        <FormField label="Birthmark">
          <BaseInput
            v-model="
              t.birthmark
            "
          />
        </FormField>


        <FormField label="Tattoo">
          <BaseInput
            v-model="
              t.tattoo
            "
          />
        </FormField>


        <FormField label="Missing body part">
          <BaseInput
            v-model="
              t.missingBodyPart
            "
            placeholder="Left index finger"
          />
        </FormField>


        <div
          class="sm:col-span-2"
        >
          <FormField label="Clinical notes">
            <BaseTextarea
              v-model="
                t.notes
              "
            />
          </FormField>
        </div>


        <div
          class="sm:col-span-2 flex justify-end gap-2 border-t pt-4"
        >
          <BaseButton
            variant="secondary"
            type="button"
            @click="
              openTreatment =
                false
            "
          >
            Cancel
          </BaseButton>


          <BaseButton type="submit">
            Save clinical record
          </BaseButton>
        </div>
      </form>
    </Modal>
  </div>


  <div
    v-else
    class="card p-12 text-center"
  >
    <p
      class="text-sm text-slate-500"
    >
      Patient not found.
    </p>
  </div>
</template>


<script setup lang="ts">
import { calculateAge } from "../utils/patient";

import {
  computed,
  reactive,
  ref,
} from "vue";

import {
  RouterLink,
  useRoute,
} from "vue-router";

import BaseButton
  from "../components/ui/BaseButton.vue";

import BaseInput
  from "../components/ui/BaseInput.vue";

import BaseSelect
  from "../components/ui/BaseSelect.vue";

import BaseTextarea
  from "../components/ui/BaseTextarea.vue";

import FormField
  from "../components/forms/FormField.vue";

import PageHeader
  from "../components/PageHeader.vue";

import Modal
  from "../components/Modal.vue";

import {
  apiGet,
} from "../services/api";

import {
  useEHR,
} from "../stores/ehr";

import type {
  AdmissionRecord,
} from "../types";


const Info = {
  props: [
    "l",
    "v",
  ],

  template: `
    <div class="rounded-xl bg-slate-50 p-3">
      <p class="label">
        {{ l }}
      </p>

      <p class="mt-1 text-sm font-bold">
        {{ v || "—" }}
      </p>
    </div>
  `,
};


const route =
  useRoute();


const {
  patientById,
  getPatientAdmissions,
  treatmentsForPatient,
  addTreatment,
} =
  useEHR();


/*
 * Patient data is loaded asynchronously from PostgreSQL,
 * therefore the patient remains computed.
 */
const patient =
  computed(() =>
    patientById(
      String(
        route.params.id,
      ),
    ),
  );


const records =
  computed(() =>
    patient.value
      ? treatmentsForPatient(
          patient.value.id,
        )
      : [],
  );


const age = computed(() =>
  patient.value?.dateOfBirth
    ? calculateAge(
        patient.value.dateOfBirth,
      ) ?? 0
    : 0,
);


/* ============================================================
   ADMISSION HISTORY
   ============================================================ */

const admissions =
  ref<AdmissionRecord[]>(
    [],
  );

const admissionLoading =
  ref(false);

const admissionError =
  ref("");


/* ============================================================
   LONGITUDINAL SOURCE EVIDENCE
   ============================================================ */

type EvidenceDetail = {
  label: string;
  value: string;
};

type EvidenceRow = {
  key: string;
  title: string;
  subtitle: string;
  date: string;
  details: EvidenceDetail[];
};

type EvidenceSection = {
  key: string;
  label: string;
  rows: EvidenceRow[];
};


const evidenceLoading =
  ref(false);


const evidenceError =
  ref("");


const evidence =
  ref<Record<string, any[]>>({});


const evidenceLabels: Array<[
  string,
  string
]> = [
  [
    "encounters",
    "Encounters",
  ],
  [
    "admissions",
    "Admissions",
  ],
  [
    "bht",
    "BHT",
  ],
  [
    "surgeries",
    "Surgery",
  ],
  [
    "procedures",
    "Procedures",
  ],
  [
    "fractures",
    "Fractures",
  ],
  [
    "devices",
    "Medical devices",
  ],
  [
    "dental",
    "Dental",
  ],
  [
    "observations",
    "Clinical observations",
  ],
  [
    "treatments",
    "Treatments",
  ],
  [
    "investigations",
    "Investigations",
  ],
  [
    "medications",
    "Medication",
  ],
];


const evidenceSections =
  computed<EvidenceSection[]>(
    () =>
      evidenceLabels.map(
        ([key, label]) => ({
          key,
          label,
          rows: (
            Array.isArray(
              evidence.value[key],
            )
              ? evidence.value[key]
              : []
          )
            .slice(0, 8)
            .map(
              (
                row: any,
                index: number,
              ) =>
                normalizeEvidenceRow(
                  key,
                  row,
                  index,
                ),
            ),
        }),
      ),
  );


function normalizeEvidenceRow(
  source: string,
  row: any,
  index: number,
): EvidenceRow {
  const get = (
    ...keys: string[]
  ): any => {
    for (
      const key of keys
    ) {
      if (
        row?.[key] !==
          undefined &&
        row?.[key] !== null &&
        row?.[key] !== ""
      ) {
        return row[key];
      }
    }

    return null;
  };


  const toText = (
    value: any,
  ): string => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "";
    }

    if (
      typeof value ===
        "boolean"
    ) {
      return value
        ? "Yes"
        : "No";
    }

    if (
      typeof value ===
        "object"
    ) {
      return JSON.stringify(
        value,
      );
    }

    return String(
      value,
    );
  };


  const details: EvidenceDetail[] = [];


  const add = (
    label: string,
    value: any,
  ) => {
    const text =
      toText(value);

    if (!text) {
      return;
    }

    details.push({
      label,
      value: text,
    });
  };


  let title =
    "Clinical record";

  let subtitle =
    "";

  let date =
    toText(
      get(
        "encounter_date",
        "entry_date",
        "surgery_date",
        "procedure_date",
        "fracture_date",
        "record_date",
        "observed_date",
        "treatment_date",
        "performed_date",
        "requested_date",
        "start_date",
        "implantation_date",
      ),
    );


  switch (
    source
  ) {
    case "encounters":
      title =
        toText(
          get(
            "encounter_type",
          ),
        ) ||
        "Clinical encounter";

      subtitle =
        toText(
          get(
            "chief_complaint",
            "department",
          ),
        );

      add(
        "Department",
        get(
          "department",
        ),
      );

      add(
        "Status",
        get("status"),
      );

      add(
        "Chief complaint",
        get(
          "chief_complaint",
        ),
      );

      add(
        "Notes",
        get("notes"),
      );
      break;


    case "admissions":
      title =
        toText(
          get(
            "admission_number",
          ),
        ) ||
        "Inpatient admission";

      subtitle =
        toText(
          get(
            "ward_name",
            "admission_diagnosis",
          ),
        );

      date =
        toText(
          get(
            "admission_date",
          ),
        );

      add(
        "Ward",
        get("ward_name"),
      );

      add(
        "Bed",
        get("bed_number"),
      );

      add(
        "Diagnosis",
        get(
          "admission_diagnosis",
        ),
      );

      add(
        "Reason",
        get(
          "admission_reason",
        ),
      );

      add(
        "Doctor",
        get("doctor_name"),
      );

      add(
        "Discharge diagnosis",
        get(
          "discharge_diagnosis",
        ),
      );
      break;


    case "bht":
      title =
        toText(
          get(
            "entry_title",
            "entry_type",
          ),
        ) ||
        "BHT entry";

      subtitle =
        toText(
          get(
            "diagnosis",
            "assessment",
          ),
        );

      add(
        "Entry type",
        get("entry_type"),
      );

      add(
        "Diagnosis",
        get("diagnosis"),
      );

      add(
        "Assessment",
        get("assessment"),
      );

      add(
        "Plan",
        get("plan"),
      );

      add(
        "Vitals",
        [
          get("temperature_c")
            ? `Temp ${get("temperature_c")} °C`
            : "",
          get("pulse_bpm")
            ? `Pulse ${get("pulse_bpm")} bpm`
            : "",
          get("systolic_bp") !== null &&
          get("diastolic_bp") !== null
            ? `BP ${get("systolic_bp")}/${get("diastolic_bp")}`
            : "",
          get("spo2_percent")
            ? `SpO₂ ${get("spo2_percent")}%`
            : "",
        ]
          .filter(Boolean)
          .join(" · "),
      );

      add(
        "Recorded by",
        get(
          "recorded_by_name",
        ),
      );
      break;


    case "surgeries":
      title =
        toText(
          get(
            "surgery_name",
          ),
        ) ||
        "Surgery";

      subtitle =
        toText(
          get(
            "postoperative_diagnosis",
            "preoperative_diagnosis",
            "body_site",
          ),
        );

      add(
        "Body site",
        get("body_site"),
      );

      add(
        "Laterality",
        get("laterality"),
      );

      add(
        "Pre-op diagnosis",
        get(
          "preoperative_diagnosis",
        ),
      );

      add(
        "Post-op diagnosis",
        get(
          "postoperative_diagnosis",
        ),
      );

      add(
        "Findings",
        get("findings"),
      );

      add(
        "Surgical notes",
        get("surgical_notes"),
      );

      add(
        "Surgeon",
        get("surgeon_name"),
      );
      break;


    case "procedures":
      title =
        toText(
          get(
            "procedure_name",
          ),
        ) ||
        "Procedure";

      subtitle =
        toText(
          get(
            "indication",
            "body_site",
          ),
        );

      add(
        "Body site",
        get("body_site"),
      );

      add(
        "Laterality",
        get("laterality"),
      );

      add(
        "Indication",
        get("indication"),
      );

      add(
        "Findings",
        get("findings"),
      );

      add(
        "Outcome",
        get("outcome"),
      );

      add(
        "Performed by",
        get(
          "performed_by_name",
        ),
      );
      break;


    case "fractures":
      title =
        toText(
          get("body_part"),
        )
          ? `Fracture · ${toText(get("body_part"))}`
          : "Fracture";

      subtitle =
        toText(
          get(
            "fracture_type",
            "laterality",
          ),
        );

      add(
        "Body part",
        get("body_part"),
      );

      add(
        "Laterality",
        get("laterality"),
      );

      add(
        "Fracture type",
        get("fracture_type"),
      );

      add(
        "Treatment",
        get(
          "treatment_description",
        ),
      );

      add(
        "Healed date",
        get("healed_date"),
      );

      add(
        "Notes",
        get("notes"),
      );
      break;


    case "devices":
      title =
        toText(
          get(
            "device_name",
            "device_type",
          ),
        ) ||
        "Medical device";

      subtitle =
        toText(
          get(
            "body_site",
            "manufacturer",
          ),
        );

      add(
        "Device type",
        get("device_type"),
      );

      add(
        "Manufacturer",
        get("manufacturer"),
      );

      add(
        "Model",
        get("model_number"),
      );

      add(
        "Serial number",
        get("serial_number"),
      );

      add(
        "Body site",
        get("body_site"),
      );

      add(
        "Laterality",
        get("laterality"),
      );

      add(
        "Status",
        get("status"),
      );
      break;


    case "dental":
      title =
        get("tooth_number") !== null
          ? `Dental record · Tooth ${toText(get("tooth_number"))}`
          : "Dental record";

      subtitle =
        toText(
          get(
            "condition",
            "treatment",
          ),
        );

      add(
        "Tooth number",
        get("tooth_number"),
      );

      add(
        "Condition",
        get("condition"),
      );

      add(
        "Treatment",
        get("treatment"),
      );

      add(
        "Filling type",
        get("filling_type"),
      );

      add(
        "Crown present",
        get("crown_present"),
      );

      add(
        "Implant present",
        get("implant_present"),
      );
      break;


    case "observations":
      title =
        toText(
          get(
            "observation_type",
          ),
        ) ||
        "Clinical observation";

      subtitle =
        toText(
          get(
            "observation_value",
            "body_site",
          ),
        );

      add(
        "Observation",
        get(
          "observation_value",
        ),
      );

      add(
        "Body site",
        get("body_site"),
      );

      add(
        "Laterality",
        get("laterality"),
      );

      add(
        "Recorded by",
        get(
          "recorded_by_name",
        ),
      );

      add(
        "Notes",
        get("notes"),
      );
      break;


    case "treatments":
      title =
        toText(
          get(
            "treatment_name",
            "treatment_type",
          ),
        ) ||
        "Treatment";

      subtitle =
        toText(
          get(
            "description",
            "body_site",
          ),
        );

      add(
        "Treatment type",
        get(
          "treatment_type",
        ),
      );

      add(
        "Description",
        get("description"),
      );

      add(
        "Body site",
        get("body_site"),
      );

      add(
        "Laterality",
        get("laterality"),
      );

      add(
        "Outcome",
        get("outcome"),
      );

      add(
        "Complications",
        get("complications"),
      );

      add(
        "Performed by",
        get(
          "performed_by_name",
        ),
      );
      break;


    case "investigations":
      title =
        toText(
          get(
            "investigation_name",
          ),
        ) ||
        "Investigation";

      subtitle =
        toText(
          get(
            "result_summary",
            "clinical_notes",
          ),
        );

      add(
        "Type",
        get(
          "investigation_type",
        ),
      );

      add(
        "Result",
        get("result_summary"),
      );

      add(
        "Value",
        get("result_value"),
      );

      add(
        "Unit",
        get("unit"),
      );

      add(
        "Body site",
        get("body_site"),
      );

      add(
        "Priority",
        get("priority"),
      );

      add(
        "Status",
        get("status"),
      );

      add(
        "Verified by",
        get(
          "verified_by_name",
        ),
      );
      break;


    case "medications":
      title =
        toText(
          get(
            "medication_name",
          ),
        ) ||
        "Medication order";

      subtitle =
        toText(
          get(
            "dosage",
            "frequency",
          ),
        );

      date =
        toText(
          get(
            "start_date",
            "encounter_date",
          ),
        );

      add(
        "Strength",
        get("strength"),
      );

      add(
        "Dosage",
        get("dosage"),
      );

      add(
        "Route",
        get("route"),
      );

      add(
        "Frequency",
        get("frequency"),
      );

      add(
        "Indication",
        get("indication"),
      );

      add(
        "Instructions",
        get("instructions"),
      );

      add(
        "Order status",
        get("order_status"),
      );

      add(
        "Prescriber",
        get(
          "prescriber_name",
        ),
      );
      break;


    default:
      add(
        "Record",
        JSON.stringify(
          row,
        ),
      );
      break;
  }


  return {
    key:
      `${source}-${String(
        get(
          "encounter_id",
          "admission_id",
          "bht_entry_id",
          "surgery_id",
          "procedure_id",
          "fracture_id",
          "device_id",
          "dental_record_id",
          "observation_id",
          "treatment_id",
          "investigation_id",
          "medication_order_id",
        ) ?? index
      )}-${index}`,

    title,

    subtitle,

    date: formatEvidenceDate(
      date,
    ),

    details:
      details.slice(
        0,
        8,
      ),
  };
}


function formatEvidenceDate(
  value: string,
): string {
  if (!value) {
    return "";
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


async function loadEvidence() {
  const patientId =
    String(
      route.params.id ??
        "",
    );

  if (!patientId) {
    evidence.value = {};
    evidenceError.value =
      "Patient ID is missing.";
    return;
  }

  evidenceLoading.value =
    true;

  evidenceError.value =
    "";

  try {
    const response =
      await apiGet<any>(
        `/ecis/candidates/${patientId}/evidence`,
      );

    const data =
      response?.data ||
      {};

    evidence.value =
      data.sources ||
      data.evidence ||
      {};
  } catch (error) {
    evidence.value =
      {};

    evidenceError.value =
      error instanceof Error
        ? error.message
        : "Unable to load longitudinal source evidence.";
  } finally {
    evidenceLoading.value =
      false;
  }
}


function evidenceCount(
  key: string,
): number {
  const rows =
    evidence.value[key];

  return Array.isArray(rows)
    ? rows.length
    : 0;
}


function formatDateTime(
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
    return String(
      value,
    );
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


async function loadAdmissionHistory() {
  const patientId =
    String(
      route.params.id ??
        "",
    );

  if (!patientId) {
    admissions.value =
      [];

    admissionError.value =
      "Patient ID is missing.";

    return;
  }

  admissionLoading.value =
    true;

  admissionError.value =
    "";

  try {
    admissions.value =
      await getPatientAdmissions(
        patientId,
      );
  } catch (error) {
    admissions.value =
      [];

    admissionError.value =
      error instanceof Error
        ? error.message
        : "Unable to load inpatient admission history.";
  } finally {
    admissionLoading.value =
      false;
  }
}


/* ============================================================
   CLINICAL RECORD
   ============================================================ */

const openTreatment =
  ref(false);


const t =
  reactive<any>({
    type: "OPD",

    date:
      new Date()
        .toISOString()
        .slice(
          0,
          10,
        ),

    department:
      "Medicine",

    doctor:
      "",

    diagnosis:
      "",

    treatment:
      "",

    notes:
      "",

    bodyRegion:
      "",

    clinicalFinding:
      "",

    implant:
      "",

    implantSerial:
      "",

    scar:
      "",

    oldFracture:
      "",

    birthmark:
      "",

    tattoo:
      "",

    missingBodyPart:
      "",
  });


function save() {
  if (
    !patient.value
  ) {
    return;
  }

  void addTreatment({
    ...t,

    patientId:
      patient.value.id,
  });

  openTreatment.value =
    false;

  alert(
    "Clinical record saved to this patient EHR.",
  );
}


/*
 * Load admission history when the Patient EHR opens.
 */
void loadAdmissionHistory();
void loadEvidence();
</script>