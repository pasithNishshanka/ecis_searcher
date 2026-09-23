<template>
  <div>
    <PageHeader
      eyebrow="Clinical procedures"
      title="Surgery & Procedures"
      description="Select a registered patient, choose the real clinical encounter, review previous procedures, then record a new surgery or procedure against the same EHR."
    >
      <div class="flex flex-wrap gap-2">
        <BaseButton
          :disabled="!selected || !encounters.length"
          @click="openRecord('SURGERY')"
        >
          <template #icon>
            <Plus :size="16" />
          </template>
          New surgery
        </BaseButton>

        <BaseButton
          variant="secondary"
          :disabled="!selected || !encounters.length"
          @click="openRecord('PROCEDURE')"
        >
          <template #icon>
            <ClipboardPlus :size="16" />
          </template>
          New procedure
        </BaseButton>
      </div>
    </PageHeader>

    <section class="card p-5">
      <h2 class="section-title text-base">
        Registered patients
      </h2>

      <p class="muted mt-1">
        Search and select the patient before recording a surgery or procedure.
      </p>

      <PatientLookup
        v-model="selected"
        :patients="patients"
        class="mt-4"
        label=""
        placeholder="Search name / ID / NIC"
      />

      <div
        v-if="selected"
        class="mt-4 rounded-xl border border-teal-100 bg-teal-50 p-4"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p
              class="text-[11px] font-bold uppercase tracking-wide text-teal-700"
            >
              Selected patient
            </p>

            <p class="mt-1 text-sm font-bold text-teal-950">
              {{ selected.firstName }}
              {{ selected.lastName }}
            </p>

            <p class="mt-1 text-xs text-teal-700">
              {{ selected.patientNumber }}
              <span v-if="selected.nic">
                · {{ selected.nic }}
              </span>
            </p>
          </div>

          <BaseButton
            variant="ghost"
            size="sm"
            type="button"
            @click="clearPatient"
          >
            Change patient
          </BaseButton>
        </div>
      </div>

      <div
        v-else
        class="mt-6 rounded-xl bg-slate-50 p-5 text-center"
      >
        <p class="text-sm text-slate-400">
          Search and select a registered patient to continue.
        </p>
      </div>
    </section>

    <section
      v-if="selected"
      class="mt-6 card p-5"
    >
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="section-title">
            {{ selected.firstName }}
            {{ selected.lastName }}
          </h2>

          <p class="muted mt-1">
            {{ selected.patientNumber }}
            ·
            {{ selected.gender || "Gender not recorded" }}
            ·
            {{ selected.bloodGroup || "Blood group not recorded" }}
          </p>
        </div>

        <RouterLink :to="`/patients/${selected.id}`">
          <BaseButton variant="secondary">
            Open full EHR
            <ArrowRight :size="15" />
          </BaseButton>
        </RouterLink>
      </div>

      <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InfoBox
          label="Date of birth"
          :value="selected.dateOfBirth || '—'"
        />

        <InfoBox
          label="Age"
          :value="age ? `${age} years` : '—'"
        />

        <InfoBox
          label="Height"
          :value="
            selected.heightCm
              ? `${selected.heightCm} cm`
              : '—'
          "
        />

        <InfoBox
          label="Weight"
          :value="
            selected.weightKg
              ? `${selected.weightKg} kg`
              : '—'
          "
        />
      </div>
    </section>

    <section
      v-if="selected"
      class="mt-6 card overflow-hidden"
    >
      <div
        class="flex flex-wrap items-center justify-between gap-3 border-b p-5"
      >
        <div>
          <h2 class="section-title">
            Clinical encounter
          </h2>

          <p class="muted mt-1">
            Every new surgery or procedure must be linked to an actual patient
            encounter.
          </p>
        </div>

        <StatusBadge
          tone="info"
          :label="
            `${encounters.length} encounter${
              encounters.length === 1 ? '' : 's'
            }`
          "
        />
      </div>

      <div
        v-if="loadingContext"
        class="p-10 text-center text-sm text-slate-400"
      >
        Loading patient encounters...
      </div>

      <div
        v-else-if="contextError"
        class="p-8 text-center"
      >
        <p class="text-sm text-red-600">
          {{ contextError }}
        </p>

        <BaseButton
          class="mt-3"
          variant="secondary"
          type="button"
          @click="reloadContext"
        >
          Try again
        </BaseButton>
      </div>

      <div
        v-else-if="encounters.length"
        class="p-5"
      >
        <FormField
          label="Recording encounter"
          required
        >
          <BaseSelect
            v-model="selectedEncounterId"
          >
            <option value="">
              Select the encounter
            </option>

            <option
              v-for="encounter in encounters"
              :key="encounter.encounter_id"
              :value="String(encounter.encounter_id)"
            >
              {{ encounterLabel(encounter) }}
            </option>
          </BaseSelect>
        </FormField>

        <div
          v-if="selectedEncounter"
          class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <div class="grid gap-3 sm:grid-cols-3">
            <InfoBox
              label="Encounter"
              :value="
                selectedEncounter.encounter_type || '—'
              "
            />

            <InfoBox
              label="Department"
              :value="
                selectedEncounter.department || '—'
              "
            />

            <InfoBox
              label="Date"
              :value="
                formatDate(selectedEncounter.encounter_date)
              "
            />
          </div>

          <div
            v-if="selectedEncounter.admission_number"
            class="mt-3 rounded-xl bg-white p-3"
          >
            <p class="label">
              Admission
            </p>

            <p class="mt-1 text-sm font-bold text-slate-800">
              {{ selectedEncounter.admission_number }}

              <span
                v-if="selectedEncounter.ward_name"
                class="font-normal text-slate-500"
              >
                ·
                {{ selectedEncounter.ward_name }}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div
        v-else
        class="p-10 text-center"
      >
        <p class="text-sm font-bold text-slate-700">
          No clinical encounter found
        </p>

        <p class="mt-1 text-sm text-slate-400">
          Create an OPD, clinic, ward, or other valid encounter for this patient
          before recording a surgery or procedure.
        </p>
      </div>
    </section>

    <section
      v-if="selected"
      class="mt-6 card overflow-hidden"
    >
      <div
        class="flex flex-wrap items-center justify-between gap-3 border-b p-5"
      >
        <div>
          <h2 class="section-title">
            Surgery & Procedure History
          </h2>

          <p class="muted mt-1">
            Existing clinical records for the selected patient.
          </p>
        </div>

        <StatusBadge
          tone="info"
          :label="`${history.length} records`"
        />
      </div>

      <div
        v-if="loadingHistory"
        class="p-10 text-center text-sm text-slate-400"
      >
        Loading surgery and procedure history...
      </div>

      <div
        v-else-if="historyError"
        class="p-8 text-center"
      >
        <p class="text-sm text-red-600">
          {{ historyError }}
        </p>

        <BaseButton
          class="mt-3"
          variant="secondary"
          type="button"
          @click="reloadHistory"
        >
          Try again
        </BaseButton>
      </div>

      <div
        v-else-if="history.length"
        class="divide-y divide-slate-100"
      >
        <article
          v-for="record in history"
          :key="record.key"
          class="p-5"
        >
          <div
            class="flex flex-wrap items-start justify-between gap-3"
          >
            <div>
              <StatusBadge
                tone="info"
                :label="
                  record.type === 'SURGERY'
                    ? 'SURGERY'
                    : 'PROCEDURE'
                "
              />

              <h3 class="mt-2 font-bold text-slate-900">
                {{ record.name }}
              </h3>

              <p
                v-if="record.diagnosis"
                class="mt-1 text-sm text-slate-500"
              >
                {{ record.diagnosis }}
              </p>
            </div>

            <span class="text-xs text-slate-400">
              {{ formatDate(record.date) }}
            </span>
          </div>

          <div
            class="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2"
          >
            <p v-if="record.encounterType">
              <b>Encounter:</b>
              {{ record.encounterType }}

              <span v-if="record.department">
                ·
                {{ record.department }}
              </span>
            </p>

            <p v-if="record.admissionNumber">
              <b>Admission:</b>
              {{ record.admissionNumber }}

              <span v-if="record.wardName">
                ·
                {{ record.wardName }}
              </span>
            </p>

            <p v-if="record.bodySite">
              <b>Body site:</b>
              {{ record.bodySite }}

              <span v-if="record.laterality">
                ·
                {{ record.laterality }}
              </span>
            </p>

            <p v-if="record.provider">
              <b>Provider:</b>
              {{ record.provider }}
            </p>
          </div>

          <p
            v-if="record.findings"
            class="mt-2 text-sm text-slate-600"
          >
            <b>Findings:</b>
            {{ record.findings }}
          </p>

          <p
            v-if="record.notes"
            class="mt-2 text-sm text-slate-500"
          >
            <b>Notes:</b>
            {{ record.notes }}
          </p>

          <div
            v-if="
              record.type === 'SURGERY' &&
              (record.complications ||
                record.postoperativeDiagnosis)
            "
            class="mt-3 flex flex-wrap gap-2"
          >
            <span
              v-if="record.postoperativeDiagnosis"
              class="badge"
            >
              Post-op:
              {{ record.postoperativeDiagnosis }}
            </span>

            <span
              v-if="record.complications"
              class="badge"
            >
              Complications:
              {{ record.complications }}
            </span>
          </div>

          <div
            v-if="
              record.type === 'PROCEDURE' &&
              record.outcome
            "
            class="mt-3"
          >
            <span class="badge">
              Outcome:
              {{ record.outcome }}
            </span>
          </div>
        </article>
      </div>

      <div
        v-else
        class="p-10 text-center"
      >
        <p class="text-sm text-slate-400">
          No surgery or procedure records have been recorded for this patient
          yet.
        </p>

        <div
          v-if="encounters.length"
          class="mt-4 flex justify-center gap-2"
        >
          <BaseButton
            type="button"
            @click="openRecord('SURGERY')"
          >
            <template #icon>
              <Plus :size="16" />
            </template>
            Add surgery
          </BaseButton>

          <BaseButton
            variant="secondary"
            type="button"
            @click="openRecord('PROCEDURE')"
          >
            <template #icon>
              <ClipboardPlus :size="16" />
            </template>
            Add procedure
          </BaseButton>
        </div>
      </div>
    </section>

    <section
      v-else
      class="mt-6 card grid place-items-center p-16 text-center"
    >
      <div>
        <div
          class="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-50 text-teal-700"
        >
          <Scissors :size="26" />
        </div>

        <h2 class="mt-4 font-bold">
          Select a registered patient
        </h2>

        <p class="mt-1 text-sm text-slate-400">
          The patient's previous surgery and procedure history will appear
          here.
        </p>
      </div>
    </section>

    <Modal
      :open="modalOpen"
      :title="
        recordType === 'SURGERY'
          ? 'New surgery'
          : 'New procedure'
      "
      :description="
        recordType === 'SURGERY'
          ? 'Record the surgery against the selected patient EHR and selected clinical encounter.'
          : 'Record the procedure against the selected patient EHR and selected clinical encounter.'
      "
      @close="closeModal"
    >
      <form
        v-if="selected"
        class="grid gap-4 sm:grid-cols-2"
        @submit.prevent="saveRecord"
      >
        <div
          class="sm:col-span-2 rounded-xl bg-teal-50 p-4"
        >
          <p
            class="text-[11px] font-bold uppercase tracking-wide text-teal-700"
          >
            Patient EHR
          </p>

          <p class="mt-1 font-bold text-teal-950">
            {{ selected.firstName }}
            {{ selected.lastName }}
            ·
            {{ selected.patientNumber }}
          </p>

          <p class="mt-1 text-xs text-teal-700">
            The patient is already linked. Patient identifiers are not
            re-entered manually.
          </p>
        </div>

        <div
          class="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <p
            class="text-[11px] font-bold uppercase tracking-wide text-slate-500"
          >
            Clinical encounter
          </p>

          <p
            v-if="selectedEncounter"
            class="mt-1 text-sm font-bold text-slate-800"
          >
            {{ encounterLabel(selectedEncounter) }}
          </p>

          <p
            v-else
            class="mt-1 text-sm text-red-600"
          >
            Select a clinical encounter before saving this record.
          </p>
        </div>

        <FormField
          :label="
            recordType === 'SURGERY'
              ? 'Surgery name'
              : 'Procedure name'
          "
          required
        >
          <BaseInput
            v-model="form.name"
            required
            :placeholder="
              recordType === 'SURGERY'
                ? 'e.g. ORIF right humerus'
                : 'e.g. Wound dressing'
            "
          />
        </FormField>

        <FormField
          label="Clinical date"
          required
        >
          <BaseInput
            v-model="form.date"
            type="date"
            required
          />
        </FormField>

        <FormField
          :label="
            recordType === 'SURGERY'
              ? 'Surgery code'
              : 'Procedure code'
          "
        >
          <BaseInput
            v-model="form.code"
            placeholder="Optional local code"
          />
        </FormField>

        <FormField label="Body site">
          <BaseInput
            v-model="form.bodySite"
            placeholder="Right arm, abdomen..."
          />
        </FormField>

        <FormField label="Laterality">
          <BaseSelect v-model="form.laterality">
            <option value="">
              Not specified
            </option>

            <option value="Left">
              Left
            </option>

            <option value="Right">
              Right
            </option>

            <option value="Bilateral">
              Bilateral
            </option>

            <option value="Midline">
              Midline
            </option>
          </BaseSelect>
        </FormField>

        <div class="sm:col-span-2">
          <FormField label="Diagnosis / indication">
            <BaseInput
              v-model="form.diagnosis"
              placeholder="Reason for surgery or procedure"
            />
          </FormField>
        </div>

        <div class="sm:col-span-2">
          <FormField label="Findings">
            <BaseTextarea
              v-model="form.findings"
              placeholder="Clinical findings documented during the event"
            />
          </FormField>
        </div>

        <template v-if="recordType === 'SURGERY'">
          <FormField label="Postoperative diagnosis">
            <BaseInput
              v-model="form.postoperativeDiagnosis"
              placeholder="Postoperative diagnosis"
            />
          </FormField>

          <FormField label="Complications">
            <BaseInput
              v-model="form.complications"
              placeholder="None / documented complication"
            />
          </FormField>

          <div class="sm:col-span-2">
            <FormField label="Surgical notes">
              <BaseTextarea
                v-model="form.notes"
                placeholder="Surgical notes and relevant clinical details"
              />
            </FormField>
          </div>
        </template>

        <template v-else>
          <div class="sm:col-span-2">
            <FormField label="Outcome">
              <BaseTextarea
                v-model="form.outcome"
                placeholder="Completed, improved, referred..."
              />
            </FormField>
          </div>

          <div
            class="sm:col-span-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500"
          >
            The authenticated doctor is recorded automatically as the
            performer.
          </div>
        </template>

        <div
          class="sm:col-span-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500"
        >
          This record will remain linked to the selected patient and clinical
          encounter so it becomes part of the longitudinal EHR used by ECIS.
        </div>

        <div
          v-if="saveError"
          class="sm:col-span-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {{ saveError }}
        </div>

        <div
          class="sm:col-span-2 flex justify-end gap-2 border-t pt-4"
        >
          <BaseButton
            variant="secondary"
            type="button"
            :disabled="saving"
            @click="closeModal"
          >
            Cancel
          </BaseButton>

          <BaseButton
            type="submit"
            :disabled="
              saving ||
              !selectedEncounterId
            "
          >
            {{
              saving
                ? "Saving..."
                : recordType === "SURGERY"
                  ? "Save surgery"
                  : "Save procedure"
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

import { RouterLink } from "vue-router";

import {
  ArrowRight,
  ClipboardPlus,
  Plus,
  Scissors,
} from "lucide-vue-next";

import PageHeader from "../components/PageHeader.vue";
import Modal from "../components/Modal.vue";

import BaseButton from "../components/ui/BaseButton.vue";
import BaseInput from "../components/ui/BaseInput.vue";
import BaseSelect from "../components/ui/BaseSelect.vue";
import BaseTextarea from "../components/ui/BaseTextarea.vue";
import StatusBadge from "../components/ui/StatusBadge.vue";

import FormField from "../components/forms/FormField.vue";
import PatientLookup from "../components/patient/PatientLookup.vue";

import {
  apiGet,
  apiPost,
} from "../services/api";

import { useEHR } from "../stores/ehr";

type RecordType =
  | "SURGERY"
  | "PROCEDURE";

type EncounterRecord = {
  encounter_id: number | string;
  encounter_type: string | null;
  encounter_date: string | null;
  department: string | null;
  status: string | null;
  chief_complaint: string | null;
  notes: string | null;
  admission_id?: number | string | null;
  admission_number?: string | null;
  admission_date?: string | null;
  admission_status?: string | null;
  ward_name?: string | null;
};

type HistoryRecord = {
  key: string;
  type: RecordType;
  name: string;
  date: string;
  bodySite: string;
  laterality: string;
  provider: string;
  diagnosis: string;
  findings: string;
  notes: string;
  postoperativeDiagnosis?: string;
  complications?: string;
  outcome?: string;
  encounterType?: string;
  department?: string;
  admissionNumber?: string;
  wardName?: string;
};

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
    <div class="rounded-xl bg-slate-50 p-3">
      <p class="label">{{ label }}</p>
      <p class="mt-1 text-sm font-bold">{{ value }}</p>
    </div>
  `,
};

const { patients } = useEHR();

const selected =
  ref<any>(null);

const history =
  ref<HistoryRecord[]>([]);

const encounters =
  ref<EncounterRecord[]>([]);

const selectedEncounterId =
  ref("");

const loadingHistory =
  ref(false);

const loadingContext =
  ref(false);

const historyError =
  ref("");

const contextError =
  ref("");

const modalOpen =
  ref(false);

const saving =
  ref(false);

const saveError =
  ref("");

const recordType =
  ref<RecordType>("SURGERY");

const form = reactive({
  name: "",
  code: "",
  date: new Date()
    .toISOString()
    .slice(0, 10),
  bodySite: "",
  laterality: "",
  diagnosis: "",
  findings: "",
  postoperativeDiagnosis: "",
  complications: "",
  notes: "",
  outcome: "",
});

const age = computed(() => {
  if (!selected.value?.dateOfBirth) {
    return 0;
  }

  const dob =
    new Date(
      selected.value.dateOfBirth,
    ).getTime();

  if (!Number.isFinite(dob)) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (Date.now() - dob) /
        31557600000,
    ),
  );
});

const selectedEncounter =
  computed<EncounterRecord | null>(() => {
    if (!selectedEncounterId.value) {
      return null;
    }

    return (
      encounters.value.find(
        (encounter) =>
          String(
            encounter.encounter_id,
          ) ===
          selectedEncounterId.value,
      ) || null
    );
  });

function unwrapArray(
  response: any,
): any[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (
    Array.isArray(
      response?.data,
    )
  ) {
    return response.data;
  }

  return [];
}

function mapSurgery(
  row: any,
): HistoryRecord {
  return {
    key: `S-${row?.surgery_id}`,
    type: "SURGERY",
    name:
      row?.surgery_name ||
      "Unnamed surgery",
    date:
      row?.surgery_date ||
      "",
    bodySite:
      row?.body_site ||
      "",
    laterality:
      row?.laterality ||
      "",
    provider:
      row?.surgeon_name ||
      "",
    diagnosis:
      row?.preoperative_diagnosis ||
      "",
    findings:
      row?.findings ||
      "",
    notes:
      row?.surgical_notes ||
      "",
    postoperativeDiagnosis:
      row?.postoperative_diagnosis ||
      "",
    complications:
      row?.complications ||
      "",
    encounterType:
      row?.encounter_type ||
      "",
    department:
      row?.department ||
      "",
    admissionNumber:
      row?.admission_number ||
      "",
    wardName:
      row?.ward_name ||
      "",
  };
}

function mapProcedure(
  row: any,
): HistoryRecord {
  return {
    key: `P-${row?.procedure_id}`,
    type: "PROCEDURE",
    name:
      row?.procedure_name ||
      "Unnamed procedure",
    date:
      row?.procedure_date ||
      "",
    bodySite:
      row?.body_site ||
      "",
    laterality:
      row?.laterality ||
      "",
    provider:
      row?.performed_by_name ||
      "",
    diagnosis:
      row?.indication ||
      "",
    findings:
      row?.findings ||
      "",
    notes: "",
    outcome:
      row?.outcome ||
      "",
    encounterType:
      row?.encounter_type ||
      "",
    department:
      row?.department ||
      "",
  };
}

function encounterLabel(
  encounter: EncounterRecord,
): string {
  const date =
    formatDate(
      encounter.encounter_date,
    );

  const admission =
    encounter.admission_number
      ? ` · ${encounter.admission_number}`
      : "";

  const department =
    encounter.department
      ? ` · ${encounter.department}`
      : "";

  return `${encounter.encounter_type || "Encounter"} · ${date}${department}${admission}`;
}

async function loadContext(
  patientId: string,
) {
  loadingContext.value =
    true;

  contextError.value =
    "";

  encounters.value = [];

  selectedEncounterId.value =
    "";

  try {
    const response =
      await apiGet<any>(
        `/surgeries/patient/${patientId}/context`,
      );

    const rows =
      Array.isArray(
        response?.data?.encounters,
      )
        ? response.data.encounters
        : [];

    encounters.value =
      rows as EncounterRecord[];
  } catch (error) {
    contextError.value =
      error instanceof Error
        ? error.message
        : "Failed to load patient encounters.";
  } finally {
    loadingContext.value =
      false;
  }
}

async function loadHistory(
  patientId: string,
) {
  loadingHistory.value =
    true;

  historyError.value =
    "";

  history.value = [];

  try {
    const [
      surgeryResponse,
      procedureResponse,
    ] =
      await Promise.all([
        apiGet<any>(
          `/surgeries/patient/${patientId}`,
        ),
        apiGet<any>(
          `/procedures/patient/${patientId}`,
        ),
      ]);

    const surgeries =
      unwrapArray(
        surgeryResponse,
      ).map(mapSurgery);

    const procedures =
      unwrapArray(
        procedureResponse,
      ).map(mapProcedure);

    history.value =
      [
        ...surgeries,
        ...procedures,
      ].sort((a, b) =>
        String(b.date).localeCompare(
          String(a.date),
        ),
      );
  } catch (error) {
    historyError.value =
      error instanceof Error
        ? error.message
        : "Failed to load surgery and procedure history.";
  } finally {
    loadingHistory.value =
      false;
  }
}

watch(
  selected,
  async (
    patient,
  ) => {
    if (!patient) {
      encounters.value = [];
      selectedEncounterId.value =
        "";
      history.value = [];
      historyError.value =
        "";
      contextError.value =
        "";
      return;
    }

    const patientId =
      String(patient.id);

    await Promise.all([
      loadContext(patientId),
      loadHistory(patientId),
    ]);
  },
  {
    immediate: true,
  },
);

function clearPatient() {
  selected.value = null;

  encounters.value = [];

  selectedEncounterId.value =
    "";

  history.value = [];

  historyError.value =
    "";

  contextError.value =
    "";
}

async function reloadContext() {
  if (!selected.value) {
    return;
  }

  await loadContext(
    String(selected.value.id),
  );
}

async function reloadHistory() {
  if (!selected.value) {
    return;
  }

  await loadHistory(
    String(selected.value.id),
  );
}

function resetForm() {
  Object.assign(form, {
    name: "",
    code: "",
    date: new Date()
      .toISOString()
      .slice(0, 10),
    bodySite: "",
    laterality: "",
    diagnosis: "",
    findings: "",
    postoperativeDiagnosis: "",
    complications: "",
    notes: "",
    outcome: "",
  });
}

function openRecord(
  type: RecordType,
) {
  if (
    !selected.value ||
    !encounters.value.length
  ) {
    return;
  }

  recordType.value =
    type;

  saveError.value =
    "";

  resetForm();

  modalOpen.value =
    true;
}

function closeModal() {
  if (saving.value) {
    return;
  }

  modalOpen.value =
    false;

  saveError.value =
    "";
}

async function saveRecord() {
  if (!selected.value) {
    return;
  }

  if (!selectedEncounterId.value) {
    saveError.value =
      "Select the clinical encounter for this record.";
    return;
  }

  if (!form.name.trim()) {
    saveError.value =
      recordType.value ===
      "SURGERY"
        ? "Surgery name is required."
        : "Procedure name is required.";

    return;
  }

  if (!form.date) {
    saveError.value =
      "Clinical date is required.";

    return;
  }

  if (
    new Date(
      `${form.date}T00:00:00`,
    ).getTime() >
    Date.now()
  ) {
    saveError.value =
      "Clinical date cannot be in the future.";

    return;
  }

  saving.value =
    true;

  saveError.value =
    "";

  try {
    const patientId =
      String(selected.value.id);

    if (
      recordType.value ===
      "SURGERY"
    ) {
      await apiPost(
        "/surgeries",
        {
          patientId,
          encounterId:
            selectedEncounterId.value,
          surgeryCode:
            form.code.trim() ||
            null,
          surgeryName:
            form.name.trim(),
          surgeryDate:
            form.date,
          bodySite:
            form.bodySite.trim() ||
            null,
          laterality:
            form.laterality ||
            null,
          preoperativeDiagnosis:
            form.diagnosis.trim() ||
            null,
          postoperativeDiagnosis:
            form.postoperativeDiagnosis.trim() ||
            null,
          findings:
            form.findings.trim() ||
            null,
          complications:
            form.complications.trim() ||
            null,
          surgicalNotes:
            form.notes.trim() ||
            null,
        },
      );
    } else {
      await apiPost(
        "/procedures",
        {
          patientId,
          encounterId:
            selectedEncounterId.value,
          procedureCode:
            form.code.trim() ||
            null,
          procedureName:
            form.name.trim(),
          procedureDate:
            form.date,
          bodySite:
            form.bodySite.trim() ||
            null,
          laterality:
            form.laterality ||
            null,
          indication:
            form.diagnosis.trim() ||
            null,
          findings:
            form.findings.trim() ||
            null,
          outcome:
            form.outcome.trim() ||
            null,
        },
      );
    }

    modalOpen.value =
      false;

    resetForm();

    await loadHistory(
      patientId,
    );
  } catch (error) {
    saveError.value =
      error instanceof Error
        ? error.message
        : "Unable to save the clinical record.";
  } finally {
    saving.value =
      false;
  }
}

function formatDate(
  value:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return "Date not recorded";
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

  return new Intl.DateTimeFormat(
    "en-LK",
    {
      year: "numeric",
      month: "short",
      day: "2-digit",
    },
  ).format(date);
}
</script>