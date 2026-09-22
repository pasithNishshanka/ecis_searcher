<template>
    <div>
        <PageHeader eyebrow="Outpatient Department" title="OPD"
            description="Register and complete outpatient consultations against the patient's existing longitudinal EHR.">
            <BaseButton :disabled="!selected ||
                loadingHistory
                " @click="
            open = true
            ">
                <template #icon>
                    <Plus :size="16" />
                </template>

                New OPD visit
            </BaseButton>
        </PageHeader>

        <div v-if="error" class="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {{ error }}
        </div>

        <div class="grid gap-6 xl:grid-cols-[340px_1fr]">
            <section class="card p-5">
                <h2 class="section-title text-base">
                    Registered patients
                </h2>

                <p class="muted mt-1">
                    Search the existing patient before opening an OPD consultation.
                </p>

                <PatientLookup v-model="selected" :patients="patients" class="mt-4" label=""
                    placeholder="Search name / ID / NIC" />

                <div v-if="!selected" class="mt-6 rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-400">
                    Search and select a registered patient to continue.
                </div>

                <div v-if="selected" class="mt-5 rounded-xl bg-teal-50 p-4">
                    <p class="text-xs font-black uppercase tracking-wider text-teal-700">
                        Selected patient
                    </p>

                    <p class="mt-1 font-black text-teal-950">
                        {{ selected.firstName }}
                        {{ selected.lastName }}
                    </p>

                    <p class="text-xs text-teal-800">
                        {{ selected.patientNumber }}

                        ·

                        {{
                            selected.nic ||
                        "NIC not recorded"
                        }}
                    </p>
                </div>
            </section>

            <section v-if="selected" class="space-y-5">
                <div class="card p-5">
                    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                        <div>
                            <p class="text-xs font-black uppercase tracking-wider text-teal-700">
                                Patient EHR
                            </p>

                            <h2 class="mt-1 section-title">
                                {{ selected.firstName }}
                                {{ selected.lastName }}
                            </h2>

                            <p class="muted">
                                {{ selected.patientNumber }}

                                ·

                                {{
                                    selected.gender ||
                                "Gender not recorded"
                                }}
                            </p>
                        </div>

                        <RouterLink :to="`/patients/${selected.id}`">
                            <BaseButton variant="secondary">
                                Open full EHR

                                <ArrowRight :size="15" />
                            </BaseButton>
                        </RouterLink>
                    </div>

                    <div class="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <InfoBox label="DOB" :value="selected.dateOfBirth
                            " />

                        <InfoBox label="Age" :value="`${age} years`" />

                        <InfoBox label="Blood" :value="selected.bloodGroup ||
                            '—'
                            " />

                        <InfoBox label="District" :value="selected.district ||
                            '—'
                            " />
                    </div>
                </div>

                <div class="card overflow-hidden">
                    <div class="border-b p-5">
                        <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                            <div>
                                <h2 class="section-title">
                                    OPD consultation history
                                </h2>

                                <p class="muted mt-1">
                                    These are the patient's actual OPD encounters stored in the hospital EHR.
                                </p>
                            </div>

                            <StatusBadge tone="info" :label="`${history.length} visits`" />
                        </div>
                    </div>

                    <div v-if="loadingHistory" class="p-10 text-center text-sm text-slate-400">
                        Loading OPD history...
                    </div>

                    <div v-else-if="
                        history.length
                    " class="divide-y divide-slate-100">
                        <article v-for="
visit in history
              " :key="visit.opd_visit_id
                " class="p-5">
                            <div class="flex flex-col justify-between gap-3 sm:flex-row">
                                <div>
                                    <div class="flex flex-wrap items-center gap-2">
                                        <StatusBadge tone="success" :label="visit.status
                                            " />

                                        <span class="badge">
                                            {{
                                                visit.opd_number
                                            }}
                                        </span>
                                    </div>

                                    <h3 class="mt-2 font-bold text-slate-900">
                                        {{
                                            visit.diagnosis_summary
                                        }}
                                    </h3>

                                    <p class="mt-1 text-sm text-slate-500">
                                        {{
                                            visit.department ||
                                        "OPD"
                                        }}

                                        ·

                                        {{
                                            visit.doctor_name ||
                                        "Doctor not recorded"
                                        }}
                                    </p>
                                </div>

                                <div class="text-left text-xs text-slate-400 sm:text-right">
                                    {{
                                        formatDate(
                                            visit.visit_date,
                                    )
                                    }}
                                </div>
                            </div>

                            <div class="mt-4 grid gap-3 md:grid-cols-2">
                                <div class="rounded-xl bg-slate-50 p-3">
                                    <p class="label">
                                        Chief complaint
                                    </p>

                                    <p class="mt-1 text-sm text-slate-700">
                                        {{
                                            visit.chief_complaint ||
                                        "Not recorded"
                                        }}
                                    </p>
                                </div>

                                <div class="rounded-xl bg-slate-50 p-3">
                                    <p class="label">
                                        Clinical notes
                                    </p>

                                    <p class="mt-1 whitespace-pre-line text-sm text-slate-700">
                                        {{
                                            visit.clinical_notes ||
                                        "Not recorded"
                                        }}
                                    </p>
                                </div>
                            </div>

                            <div v-if="
                                visit.follow_up_required
                            " class="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                                <p class="text-xs font-black uppercase tracking-wider text-amber-700">
                                    Follow-up required
                                </p>

                                <p class="mt-1 text-sm font-semibold text-amber-900">
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

                    <div v-else class="p-10 text-center text-sm text-slate-400">
                        No OPD visits have been recorded for this patient yet.
                    </div>
                </div>
            </section>

            <section v-else class="card grid place-items-center p-16 text-center">
                <div>
                    <div class="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                        <UserRound :size="26" />
                    </div>

                    <h2 class="mt-4 font-bold">
                        Select a registered patient
                    </h2>

                    <p class="mt-1 text-sm text-slate-400">
                        The patient's OPD history will appear here.
                    </p>
                </div>
            </section>
        </div>

        <Modal :open="open" title="New OPD consultation"
            description="This creates a real OPD encounter linked to the selected patient's hospital EHR."
            @close="closeForm">
            <form v-if="selected" @submit.prevent="
                save
            " class="grid gap-4 sm:grid-cols-2">
                <div class="sm:col-span-2 rounded-xl bg-teal-50 p-4">
                    <p class="text-xs font-black uppercase tracking-wider text-teal-700">
                        Patient
                    </p>

                    <p class="mt-1 font-black text-teal-950">
                        {{ selected.firstName }}
                        {{ selected.lastName }}
                    </p>

                    <p class="text-xs text-teal-800">
                        {{
                            selected.patientNumber
                        }}
                    </p>
                </div>

                <FormField label="Visit date" required>
                    <BaseInput v-model="form.visitDate
                        " type="datetime-local" required :disabled="saving" />
                </FormField>

                <FormField label="Department" required>
                    <BaseInput v-model="form.department
                        " placeholder="Medicine / Cardiology / Orthopaedics" required :disabled="saving" />
                </FormField>

                <div class="sm:col-span-2">
                    <FormField label="Chief complaint" required>
                        <BaseInput v-model="form.chiefComplaint
                            " placeholder="Reason for today's visit" required :disabled="saving" />
                    </FormField>
                </div>

                <div class="sm:col-span-2">
                    <FormField label="Diagnosis" required>
                        <BaseInput v-model="form.diagnosisSummary
                            " placeholder="Clinical diagnosis / assessment" required :disabled="saving" />
                    </FormField>
                </div>

                <div class="sm:col-span-2">
                    <FormField label="Clinical notes">
                        <BaseTextarea v-model="form.clinicalNotes
                            " rows="5" placeholder="History, examination findings and clinical assessment..." :disabled="saving" />
                    </FormField>
                </div>

                <div class="sm:col-span-2 rounded-xl border border-slate-200 p-4">
                    <label class="flex items-center gap-3 text-sm font-semibold text-slate-700">
                        <input v-model="form.followUpRequired
                            " type="checkbox" class="size-4 rounded border-slate-300 text-teal-600" :disabled="saving" />

                        Follow-up required
                    </label>

                    <div v-if="
                        form.followUpRequired
                    " class="mt-4">
                        <FormField label="Follow-up date" required>
                            <BaseInput v-model="form.followUpDate
                                " type="date" required :disabled="saving" />
                        </FormField>
                    </div>
                </div>

                <div class="sm:col-span-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                    The authenticated hospital user is recorded as the consulting user by the backend. The frontend does
                    not
                    choose or spoof a doctor ID.
                </div>

                <div class="sm:col-span-2 flex justify-end gap-2 border-t pt-4">
                    <BaseButton variant="secondary" type="button" :disabled="saving" @click="
                        closeForm
                    ">
                        Cancel
                    </BaseButton>

                    <BaseButton type="submit" :disabled="saving">
                        {{
                            saving
                                ? "Saving..."
                                : "Complete OPD visit"
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
    Plus,
    UserRound,
} from "lucide-vue-next";

import PageHeader from "../components/PageHeader.vue";

import Modal from "../components/Modal.vue";

import BaseButton from "../components/ui/BaseButton.vue";

import BaseInput from "../components/ui/BaseInput.vue";

import BaseTextarea from "../components/ui/BaseTextarea.vue";

import StatusBadge from "../components/ui/StatusBadge.vue";

import FormField from "../components/forms/FormField.vue";

import PatientLookup from "../components/patient/PatientLookup.vue";

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

interface OpdVisit {
    opd_visit_id: number;

    opd_number: string;

    visit_date: string;

    chief_complaint:
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

    encounter_id: number;

    department:
    | string
    | null;

    doctor_name:
    | string
    | null;
}

const {
    patients,
} = useEHR();

const selected =
    ref<any>(null);

const open =
    ref(false);

const saving =
    ref(false);

const loadingHistory =
    ref(false);

const error =
    ref("");

const history =
    ref<OpdVisit[]>([]);

const form = reactive({
    visitDate:
        getDefaultDateTime(),

    department:
        "Medicine",

    chiefComplaint:
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

const age = computed(
    () => {
        if (
            !selected.value
                ?.dateOfBirth
        ) {
            return 0;
        }

        return Math.floor(
            (Date.now() -
                new Date(
                    selected.value
                        .dateOfBirth,
                ).getTime()) /
            31557600000,
        );
    },
);

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
        .slice(0, 16);
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

async function loadHistory() {
    if (
        !selected.value?.id
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

                data: OpdVisit[];
            }>(
                `/opd/patients/${Number(
                    selected.value.id,
                )}/history`,
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
                : "Unable to load OPD history.";
    } finally {
        loadingHistory.value =
            false;
    }
}

watch(
    () =>
        selected.value?.id,

    () => {
        void loadHistory();
    },

    {
        immediate: true,
    },
);

function closeForm() {
    if (saving.value) {
        return;
    }

    open.value =
        false;
}

function resetForm() {
    Object.assign(
        form,
        {
            visitDate:
                getDefaultDateTime(),

            department:
                "Medicine",

            chiefComplaint:
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

async function save() {
    if (
        !selected.value?.id
    ) {
        return;
    }

    error.value =
        "";

    saving.value =
        true;

    try {
        await apiPost(
            "/opd/visits",
            {
                patientId:
                    Number(
                        selected.value.id,
                    ),

                visitDate:
                    form.visitDate,

                department:
                    form.department.trim(),

                chiefComplaint:
                    form.chiefComplaint.trim(),

                diagnosisSummary:
                    form.diagnosisSummary.trim(),

                clinicalNotes:
                    form.clinicalNotes.trim(),

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
                : "Unable to save OPD visit.";
    } finally {
        saving.value =
            false;
    }
}
</script>