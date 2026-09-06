<template>
    <div>
        <PageHeader eyebrow="Clinical procedures" title="Surgery & Procedures"
            description="Select a registered patient, review previous clinical procedures, then record a new surgery or procedure against the same EHR.">
            <div class="flex flex-wrap gap-2">
                <BaseButton :disabled="!selected" @click="openRecord('SURGERY')">
                    <template #icon>
                        <Plus :size="16" />
                    </template>
                    New surgery
                </BaseButton>

                <BaseButton variant="secondary" :disabled="!selected" @click="openRecord('PROCEDURE')">
                    <template #icon>
                        <ClipboardPlus :size="16" />
                    </template>
                    New procedure
                </BaseButton>
            </div>
        </PageHeader>

        <!-- Patient search -->
        <section class="card p-5">
            <h2 class="section-title text-base">
                Registered patients
            </h2>

            <p class="muted mt-1">
                Search and select the patient before recording a surgery or procedure.
            </p>

            <PatientLookup v-model="selected" :patients="patients" class="mt-4" label=""
                placeholder="Search name / ID / NIC" />

            <div v-if="selected" class="mt-4 rounded-xl border border-teal-100 bg-teal-50 p-4">
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p class="text-[11px] font-bold uppercase tracking-wide text-teal-700">
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

                    <BaseButton variant="ghost" size="sm" type="button" @click="clearPatient">
                        Change patient
                    </BaseButton>
                </div>
            </div>

            <div v-else class="mt-6 rounded-xl bg-slate-50 p-5 text-center">
                <p class="text-sm text-slate-400">
                    Search and select a registered patient to continue.
                </p>
            </div>
        </section>

        <!-- Selected patient information -->
        <section v-if="selected" class="mt-6 card p-5">
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
                <InfoBox label="Date of birth" :value="selected.dateOfBirth || '—'" />

                <InfoBox label="Age" :value="age ? `${age} years` : '—'" />

                <InfoBox label="Height" :value="selected.heightCm
                        ? `${selected.heightCm} cm`
                        : '—'
                    " />

                <InfoBox label="Weight" :value="selected.weightKg
                        ? `${selected.weightKg} kg`
                        : '—'
                    " />
            </div>
        </section>

        <!-- Surgery / procedure history -->
        <section v-if="selected" class="mt-6 card overflow-hidden">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b p-5">
                <div>
                    <h2 class="section-title">
                        Surgery & Procedure History
                    </h2>

                    <p class="muted mt-1">
                        Existing clinical records for the selected patient.
                    </p>
                </div>

                <StatusBadge tone="info" :label="`${history.length} records`" />
            </div>

            <div v-if="loadingHistory" class="p-10 text-center text-sm text-slate-400">
                Loading surgery and procedure history...
            </div>

            <div v-else-if="historyError" class="p-8 text-center">
                <p class="text-sm text-red-600">
                    {{ historyError }}
                </p>

                <BaseButton class="mt-3" variant="secondary" type="button" @click="reloadHistory">
                    Try again
                </BaseButton>
            </div>

            <div v-else-if="history.length" class="divide-y divide-slate-100">
                <article v-for="record in history" :key="record.key" class="p-5">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <StatusBadge tone="info" :label="record.type === 'SURGERY'
                                    ? 'SURGERY'
                                    : 'PROCEDURE'
                                " />

                            <h3 class="mt-2 font-bold text-slate-900">
                                {{ record.name }}
                            </h3>

                            <p v-if="record.diagnosis" class="mt-1 text-sm text-slate-500">
                                {{ record.diagnosis }}
                            </p>
                        </div>

                        <span class="text-xs text-slate-400">
                            {{ formatDate(record.date) }}
                        </span>
                    </div>

                    <div class="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                        <p v-if="record.bodySite">
                            <b>Body site:</b>
                            {{ record.bodySite }}

                            <span v-if="record.laterality">
                                · {{ record.laterality }}
                            </span>
                        </p>

                        <p v-if="record.provider">
                            <b>Provider:</b>
                            {{ record.provider }}
                        </p>
                    </div>

                    <p v-if="record.findings" class="mt-2 text-sm text-slate-600">
                        <b>Findings:</b>
                        {{ record.findings }}
                    </p>

                    <p v-if="record.notes" class="mt-2 text-sm text-slate-500">
                        {{ record.notes }}
                    </p>

                    <div v-if="
                        record.type === 'SURGERY' &&
                        (
                            record.complications ||
                            record.postoperativeDiagnosis
                        )
                    " class="mt-3 flex flex-wrap gap-2">
                        <span v-if="record.postoperativeDiagnosis" class="badge">
                            Post-op:
                            {{ record.postoperativeDiagnosis }}
                        </span>

                        <span v-if="record.complications" class="badge">
                            Complications:
                            {{ record.complications }}
                        </span>
                    </div>

                    <div v-if="
                        record.type === 'PROCEDURE' &&
                        record.outcome
                    " class="mt-3">
                        <span class="badge">
                            Outcome: {{ record.outcome }}
                        </span>
                    </div>
                </article>
            </div>

            <div v-else class="p-10 text-center">
                <p class="text-sm text-slate-400">
                    No surgery or procedure records have been
                    recorded for this patient yet.
                </p>

                <div class="mt-4 flex justify-center gap-2">
                    <BaseButton type="button" @click="openRecord('SURGERY')">
                        <template #icon>
                            <Plus :size="16" />
                        </template>
                        Add surgery
                    </BaseButton>

                    <BaseButton variant="secondary" type="button" @click="openRecord('PROCEDURE')">
                        <template #icon>
                            <ClipboardPlus :size="16" />
                        </template>
                        Add procedure
                    </BaseButton>
                </div>
            </div>
        </section>

        <!-- No patient selected -->
        <section v-else class="mt-6 card grid place-items-center p-16 text-center">
            <div>
                <div class="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                    <Scissors :size="26" />
                </div>

                <h2 class="mt-4 font-bold">
                    Select a registered patient
                </h2>

                <p class="mt-1 text-sm text-slate-400">
                    The patient's previous surgery and
                    procedure history will appear here.
                </p>
            </div>
        </section>

        <!-- New surgery / procedure modal -->
        <Modal :open="modalOpen" :title="recordType === 'SURGERY'
                ? 'New surgery'
                : 'New procedure'
            " :description="recordType === 'SURGERY'
            ? 'Record the surgery against the selected patient EHR.'
            : 'Record the procedure against the selected patient EHR.'
        " @close="closeModal">
            <form v-if="selected" class="grid gap-4 sm:grid-cols-2" @submit.prevent="saveRecord">
                <!-- Patient -->
                <div class="sm:col-span-2 rounded-xl bg-teal-50 p-4">
                    <p class="text-[11px] font-bold uppercase tracking-wide text-teal-700">
                        Patient EHR
                    </p>

                    <p class="mt-1 font-bold text-teal-950">
                        {{ selected.firstName }}
                        {{ selected.lastName }}
                        ·
                        {{ selected.patientNumber }}
                    </p>

                    <p class="mt-1 text-xs text-teal-700">
                        This record will be saved to this patient.
                    </p>
                </div>

                <!-- Name -->
                <FormField :label="recordType === 'SURGERY'
                        ? 'Surgery name'
                        : 'Procedure name'
                    " required>
                    <BaseInput v-model="form.name" required :placeholder="recordType === 'SURGERY'
                            ? 'e.g. ORIF right humerus'
                            : 'e.g. Wound dressing'
                        " />
                </FormField>

                <!-- Date -->
                <FormField label="Date" required>
                    <BaseInput v-model="form.date" type="date" required />
                </FormField>

                <!-- Body site -->
                <FormField label="Body site">
                    <BaseInput v-model="form.bodySite" placeholder="Right arm, abdomen..." />
                </FormField>

                <!-- Laterality -->
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

                <!-- Diagnosis / indication -->
                <div class="sm:col-span-2">
                    <FormField label="Diagnosis / indication">
                        <BaseInput v-model="form.diagnosis" placeholder="Reason for surgery or procedure" />
                    </FormField>
                </div>

                <!-- Findings -->
                <div class="sm:col-span-2">
                    <FormField label="Findings">
                        <BaseTextarea v-model="form.findings"
                            placeholder="Clinical findings documented during the event" />
                    </FormField>
                </div>

                <!-- Surgery-specific -->
                <template v-if="recordType === 'SURGERY'">
                    <FormField label="Postoperative diagnosis">
                        <BaseInput v-model="form.postoperativeDiagnosis" placeholder="Postoperative diagnosis" />
                    </FormField>

                    <FormField label="Complications">
                        <BaseInput v-model="form.complications" placeholder="None / documented complication" />
                    </FormField>

                    <div class="sm:col-span-2">
                        <FormField label="Surgical notes">
                            <BaseTextarea v-model="form.notes"
                                placeholder="Surgical notes and relevant clinical details" />
                        </FormField>
                    </div>
                </template>

                <!-- Procedure-specific -->
                <template v-else>
                    <FormField label="Outcome">
                        <BaseInput v-model="form.outcome" placeholder="Completed, improved, referred..." />
                    </FormField>

                    <FormField label="Performed by">
                        <BaseInput v-model="form.provider" placeholder="Doctor / clinician" />
                    </FormField>

                    <div class="sm:col-span-2">
                        <FormField label="Procedure notes">
                            <BaseTextarea v-model="form.notes" placeholder="Procedure notes" />
                        </FormField>
                    </div>
                </template>

                <!-- Patient link confirmation -->
                <div class="sm:col-span-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                    The selected patient is already linked.
                    You do not need to enter a patient ID manually.
                </div>

                <!-- Error -->
                <div v-if="saveError" class="sm:col-span-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    {{ saveError }}
                </div>

                <!-- Buttons -->
                <div class="sm:col-span-2 flex justify-end gap-2 border-t pt-4">
                    <BaseButton variant="secondary" type="button" :disabled="saving" @click="closeModal">
                        Cancel
                    </BaseButton>

                    <BaseButton type="submit" :disabled="saving">
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
      <p class="mt-1 text-sm font-bold">
        {{ value }}
      </p>
    </div>
  `,
};

const {
    patients,
} = useEHR();

const selected =
    ref<any>(null);

const history =
    ref<HistoryRecord[]>([]);

const loadingHistory =
    ref(false);

const historyError =
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
    provider: "",
});

const age = computed(() => {
    if (!selected.value?.dateOfBirth) {
        return 0;
    }

    const dob = new Date(
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
        key:
            `S-${row?.surgery_id}`,

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
    };
}

function mapProcedure(
    row: any,
): HistoryRecord {
    return {
        key:
            `P-${row?.procedure_id}`,

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
    };
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
            ).map(
                mapSurgery,
            );

        const procedures =
            unwrapArray(
                procedureResponse,
            ).map(
                mapProcedure,
            );

        history.value =
            [
                ...surgeries,
                ...procedures,
            ].sort(
                (a, b) =>
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
    async (patient) => {
        if (!patient) {
            history.value = [];
            historyError.value = "";
            return;
        }

        await loadHistory(
            String(patient.id),
        );
    },
    {
        immediate: true,
    },
);

function clearPatient() {
    selected.value = null;
    history.value = [];
    historyError.value = "";
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
        provider: "",
    });
}

function openRecord(
    type: RecordType,
) {
    if (!selected.value) {
        return;
    }

    recordType.value = type;
    saveError.value = "";

    resetForm();

    modalOpen.value = true;
}

function closeModal() {
    if (saving.value) {
        return;
    }

    modalOpen.value = false;
    saveError.value = "";
}

function getCurrentUserId():
    | string
    | undefined {
    const raw =
        localStorage.getItem(
            "ecis-user",
        );

    if (!raw) {
        return undefined;
    }

    try {
        const user =
            JSON.parse(raw);

        return user?.userId != null
            ? String(user.userId)
            : undefined;
    } catch {
        return undefined;
    }
}

async function saveRecord() {
    if (!selected.value) {
        return;
    }

    if (!form.name.trim()) {
        saveError.value =
            recordType.value === "SURGERY"
                ? "Surgery name is required."
                : "Procedure name is required.";

        return;
    }

    saving.value = true;
    saveError.value = "";

    try {
        const patientId =
            String(
                selected.value.id,
            );

        if (
            recordType.value ===
            "SURGERY"
        ) {
            await apiPost(
                "/surgeries",
                {
                    patientId,

                    surgeryName:
                        form.name.trim(),

                    surgeryDate:
                        form.date || null,

                    bodySite:
                        form.bodySite.trim() ||
                        null,

                    laterality:
                        form.laterality ||
                        null,

                    surgeonUserId:
                        getCurrentUserId(),

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

                    procedureName:
                        form.name.trim(),

                    procedureDate:
                        form.date || null,

                    bodySite:
                        form.bodySite.trim() ||
                        null,

                    laterality:
                        form.laterality ||
                        null,

                    performedBy:
                        getCurrentUserId(),

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
    value: string,
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