<template>
    <div class="space-y-6">
        <PageHeader eyebrow="Clinical intelligence" title="Medical Records & AI Summary"
            description="Review the selected patient's complete longitudinal EHR across encounters, admissions, BHT, investigations, medication, surgery, procedures and other clinical evidence.">
            <div class="flex flex-wrap gap-2">
                <BaseButton variant="secondary" :loading="loading" @click="reload">
                    Refresh records
                </BaseButton>

                <BaseButton :disabled="!selected ||
                    !timeline.length ||
                    generating
                    " :loading="generating" @click="generateSummary">
                    <span>✦</span>

                    {{
                        generating
                            ? "Generating..."
                            : "Generate AI Summary"
                    }}
                </BaseButton>
            </div>
        </PageHeader>


        <!-- ======================================================
         ERROR
         ====================================================== -->

        <div v-if="error" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div class="flex items-start justify-between gap-4">
                <p>
                    {{ error }}
                </p>

                <button type="button" class="text-xs font-bold underline" @click="
                    error = ''
                    ">
                    Dismiss
                </button>
            </div>
        </div>


        <div class="grid gap-5 lg:grid-cols-[300px_1fr]">
            <!-- ====================================================
           PATIENT LIST
           ==================================================== -->

            <aside class="card p-4">
                <div class="mb-4">
                    <h2 class="section-title text-base">
                        Select patient
                    </h2>

                    <p class="muted mt-1">
                        Choose an existing registered adult EHR record.
                    </p>
                </div>


                <BaseInput v-model="searchQuery
                    " placeholder="Search name / patient ID / NIC" />


                <div class="mt-3 max-h-[650px] space-y-2 overflow-y-auto">
                    <button v-for="
patient in filteredPatients
            " :key="patient.id
                " type="button" class="w-full rounded-xl border p-3 text-left transition" :class="selected?.id === patient.id
                    ? 'border-teal-300 bg-teal-50'
                    : 'border-slate-100 hover:bg-slate-50'
                " @click="
                selectPatient(patient)
                ">
                        <div class="flex gap-3">
                            <div class="avatar">
                                {{
                                    initial(
                                        patient.firstName,
                                )
                                }}{{
                                    initial(
                                        patient.lastName,
                                )
                                }}
                            </div>

                            <div class="min-w-0">
                                <b class="block truncate text-sm">
                                    {{
                                        patient.firstName
                                    }}
                                    {{
                                        patient.lastName
                                    }}
                                </b>

                                <p class="mt-1 text-xs text-slate-400">
                                    {{
                                        patient.patientNumber
                                    }}
                                </p>

                                <p v-if="
                                    patient.nic
                                " class="mt-1 truncate text-[11px] text-slate-400">
                                    NIC:
                                    {{
                                        patient.nic
                                    }}
                                </p>
                            </div>
                        </div>
                    </button>


                    <div v-if="
                        !filteredPatients.length
                    " class="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-400">
                        No matching patients found.
                    </div>
                </div>
            </aside>


            <!-- ====================================================
           MAIN
           ==================================================== -->

            <main v-if="selected" class="min-w-0 space-y-5">
                <!-- ==================================================
             PATIENT HEADER
             ================================================== -->

                <section class="card p-5">
                    <div class="flex flex-col justify-between gap-4 sm:flex-row">
                        <div class="flex gap-3">
                            <div class="avatar">
                                {{
                                    initial(
                                        selected.firstName,
                                )
                                }}{{
                                    initial(
                                        selected.lastName,
                                )
                                }}
                            </div>

                            <div>
                                <h2 class="section-title">
                                    {{
                                        selected.firstName
                                    }}
                                    {{
                                        selected.lastName
                                    }}
                                </h2>

                                <p class="muted">
                                    {{
                                        selected.patientNumber
                                    }}

                                    <span v-if="
                                        selected.bloodGroup
                                    ">
                                        ·
                                        {{
                                            selected.bloodGroup
                                        }}
                                    </span>

                                    <span v-if="
                                        selected.district
                                    ">
                                        ·
                                        {{
                                            selected.district
                                        }}
                                    </span>
                                </p>
                            </div>
                        </div>


                        <RouterLink :to="`/patients/${selected.id}`
                            ">
                            <BaseButton variant="secondary">
                                Open full EHR

                                <ArrowRight :size="15" />
                            </BaseButton>
                        </RouterLink>
                    </div>


                    <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <InfoCard label="Age" :value="`${selected.age || age} years`
                            " />

                        <InfoCard label="Blood group" :value="selected.bloodGroup ||
                            '—'
                            " />

                        <InfoCard label="Height" :value="selected.heightCm
                                ? `${selected.heightCm} cm`
                                : '—'
                            " />

                        <InfoCard label="Weight" :value="selected.weightKg
                                ? `${selected.weightKg} kg`
                                : '—'
                            " />
                    </div>


                    <div class="mt-4 grid gap-3 sm:grid-cols-2">
                        <!-- Allergies -->

                        <div class="rounded-xl bg-slate-50 p-4">
                            <p class="label">
                                Allergies
                            </p>

                            <div v-if="
                                allergyNames.length
                            " class="mt-2 flex flex-wrap gap-2">
                                <span v-for="
allergy in allergyNames
                  " :key="allergy
                    " class="badge bg-amber-100 text-amber-800">
                                    {{
                                        allergy
                                    }}
                                </span>
                            </div>

                            <p v-else class="mt-1 text-sm text-slate-500">
                                None recorded.
                            </p>
                        </div>


                        <!-- Registration -->

                        <div class="rounded-xl bg-slate-50 p-4">
                            <p class="label">
                                Registration
                            </p>

                            <p class="mt-1 text-sm text-slate-600">
                                {{
                                    selected.registrationNotes ||
                                "No registration notes recorded."
                                }}
                            </p>
                        </div>
                    </div>
                </section>


                <!-- ==================================================
             SUMMARY STATISTICS
             ================================================== -->

                <section v-if="stats" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryStat label="Timeline events" :value="stats.timeline || 0
                        " />

                    <SummaryStat label="Admissions" :value="stats.admissions || 0
                        " />

                    <SummaryStat label="Investigations" :value="stats.investigations || 0
                        " />

                    <SummaryStat label="Medications" :value="stats.medications || 0
                        " />
                </section>


                <!-- ==================================================
             LONGITUDINAL TIMELINE
             ================================================== -->

                <section class="card overflow-hidden">
                    <div
                        class="flex flex-col justify-between gap-4 border-b bg-slate-50/60 p-5 sm:flex-row sm:items-end">
                        <div>
                            <h2 class="section-title">
                                Longitudinal clinical timeline
                            </h2>

                            <p class="muted mt-1">
                                Events are assembled from the patient's existing
                                EHR records. No duplicate patient record is created
                                by this view.
                            </p>
                        </div>


                        <div class="flex flex-wrap gap-2">
                            <button v-for="
filter in timelineFilters
                " :key="filter.value
                    " type="button" class="rounded-full border px-3 py-1.5 text-xs font-bold" :class="timelineFilter === filter.value
                        ? 'border-teal-300 bg-teal-50 text-teal-800'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    " @click="
                    timelineFilter =
                    filter.value
                    ">
                                {{
                                    filter.label
                                }}
                            </button>
                        </div>
                    </div>


                    <div class="border-b p-4">
                        <BaseInput v-model="timelineSearch
                            " placeholder="Filter diagnosis, medication, procedure, note..." />
                    </div>


                    <div v-if="
                        loading
                    " class="p-12 text-center text-sm text-slate-400">
                        Loading longitudinal EHR...
                    </div>


                    <div v-else-if="
                        !filteredTimeline.length
                    " class="p-12 text-center">
                        <p class="text-sm font-bold text-slate-700">
                            No matching clinical events
                        </p>

                        <p class="mt-1 text-sm text-slate-400">
                            Try another timeline filter or search term.
                        </p>
                    </div>


                    <div v-else class="divide-y divide-slate-100">
                        <article v-for="
event in filteredTimeline
              " :key="event.key
                " class="p-5">
                            <div class="flex gap-4">
                                <div class="hidden shrink-0 sm:block">
                                    <div
                                        class="grid size-10 place-items-center rounded-xl bg-teal-50 font-black text-teal-700">
                                        {{
                                            eventIcon(
                                                event.type,
                                        )
                                        }}
                                    </div>
                                </div>


                                <div class="min-w-0 flex-1">
                                    <div class="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                                        <div class="min-w-0">
                                            <div class="flex flex-wrap items-center gap-2">
                                                <span class="badge">
                                                    {{
                                                        event.type
                                                    }}
                                                </span>

                                                <span v-if="
                                                    event.status
                                                " class="badge bg-slate-100 text-slate-600">
                                                    {{
                                                        event.status
                                                    }}
                                                </span>

                                                <span v-if="
                                                    event.department
                                                " class="badge bg-slate-50 text-slate-500">
                                                    {{
                                                        event.department
                                                    }}
                                                </span>
                                            </div>


                                            <h3 class="mt-2 font-bold text-slate-900">
                                                {{
                                                    event.title
                                                }}
                                            </h3>


                                            <p v-if="
                                                event.subtitle
                                            " class="mt-1 text-sm text-slate-500">
                                                {{
                                                    event.subtitle
                                                }}
                                            </p>
                                        </div>


                                        <span class="shrink-0 text-xs text-slate-400">
                                            {{
                                                formatDate(
                                                    event.date,
                                            )
                                            }}
                                        </span>
                                    </div>


                                    <div v-if="
                                        event.admissionNumber ||
                                        event.encounterId
                                    " class="mt-3 flex flex-wrap gap-2 text-xs">
                                        <span v-if="
                                            event.encounterId
                                        " class="rounded-lg bg-slate-50 px-2.5 py-1 text-slate-500">
                                            Encounter
                                            #
                                            {{
                                                event.encounterId
                                            }}
                                        </span>

                                        <span v-if="
                                            event.admissionNumber
                                        " class="rounded-lg bg-slate-50 px-2.5 py-1 text-slate-500">
                                            Admission
                                            {{
                                                event.admissionNumber
                                            }}
                                        </span>
                                    </div>


                                    <div v-if="
                                        eventDetailLines(event).length
                                    " class="mt-3 grid gap-2 sm:grid-cols-2">
                                        <div v-for="
line in eventDetailLines(event)
                      " :key="line.label
                        " class="rounded-xl bg-slate-50 p-3">
                                            <p class="label">
                                                {{
                                                    line.label
                                                }}
                                            </p>

                                            <p class="mt-1 text-sm text-slate-700">
                                                {{
                                                    line.value
                                                }}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </article>
                    </div>
                </section>


                <!-- ==================================================
             AI SUMMARY
             ================================================== -->

                <section class="card overflow-hidden">
                    <div
                        class="flex flex-col justify-between gap-3 border-b bg-teal-50/50 p-5 sm:flex-row sm:items-center">
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="grid size-9 place-items-center rounded-xl bg-teal-700 text-white">
                                    ✦
                                </span>

                                <h2 class="section-title">
                                    AI Clinical Summary
                                </h2>
                            </div>

                            <p class="mt-1 text-xs text-slate-500">
                                Structured summary generated from the selected
                                patient's longitudinal EHR. It does not make identity
                                decisions.
                            </p>
                        </div>


                        <BaseButton v-if="summary" variant="secondary" :disabled="generating
                            " @click="
                generateSummary
            ">
                            Regenerate
                        </BaseButton>
                    </div>


                    <div v-if="summary" class="p-5">
                        <div
                            class="rounded-xl border border-teal-100 bg-white p-5 text-sm leading-7 text-slate-700 shadow-sm">
                            <div class="mb-3 flex items-center gap-2">
                                <span class="badge bg-teal-100 text-teal-800">
                                    AI SUMMARY
                                </span>

                                <span class="text-xs text-slate-400">
                                    Structured demo generation
                                </span>
                            </div>

                            <p>
                                {{
                                    summary
                                }}
                            </p>
                        </div>


                        <div
                            class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
                            <b>
                                Important:
                            </b>

                            The summary is decision-support only. Clinical staff
                            must review the underlying EHR source records before
                            making clinical decisions.
                        </div>
                    </div>


                    <div v-else class="p-10 text-center">
                        <div
                            class="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-50 text-2xl text-teal-700">
                            ✦
                        </div>

                        <h3 class="mt-4 font-bold">
                            Longitudinal summary is ready
                        </h3>

                        <p class="mx-auto mt-1 max-w-xl text-sm text-slate-400">
                            Generate a structured summary from the patient's
                            existing EHR records without altering the underlying
                            patient identity data.
                        </p>

                        <BaseButton class="mt-5" :disabled="!timeline.length ||
                            generating
                            " :loading="generating
                " @click="
                generateSummary
            ">
                            Generate AI Summary
                        </BaseButton>
                    </div>
                </section>
            </main>


            <!-- ====================================================
           NO PATIENT
           ==================================================== -->

            <section v-else class="card grid place-items-center p-16 text-center">
                <div>
                    <div class="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-50 text-2xl text-teal-700">
                        ✦
                    </div>

                    <h2 class="mt-4 font-bold">
                        Select a patient
                    </h2>

                    <p class="mx-auto mt-1 max-w-md text-sm text-slate-400">
                        The patient's existing longitudinal EHR will be loaded
                        from the backend and shown here.
                    </p>
                </div>
            </section>
        </div>
    </div>
</template>


<script setup lang="ts">
import {
    computed,
    ref,
    watch,
} from "vue";

import {
    RouterLink,
} from "vue-router";

import {
    ArrowRight,
} from "lucide-vue-next";

import PageHeader from "../components/PageHeader.vue";

import BaseButton from "../components/ui/BaseButton.vue";
import BaseInput from "../components/ui/BaseInput.vue";

import {
    apiGet,
} from "../services/api";

import {
    useEHR,
} from "../stores/ehr";


type TimelineEvent = {
    key: string;

    type: string;

    date:
    | string
    | null;

    id:
    | number
    | string;

    title: string;

    subtitle:
    | string
    | null;

    status:
    | string
    | null;

    encounterId:
    | number
    | string
    | null;

    admissionId:
    | number
    | string
    | null;

    admissionNumber:
    | string
    | null;

    department:
    | string
    | null;

    details:
    Record<string, any>;
};


type MedicalRecordResponse = {
    success: boolean;

    data: {
        patient: any;

        stats:
        Record<string, number>;

        timeline:
        TimelineEvent[];

        sections:
        Record<string, any[]>;
    };
};


const InfoCard = {
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


const SummaryStat = {
    props: {
        label: {
            type: String,
            required: true,
        },

        value: {
            type: Number,
            required: true,
        },
    },

    template: `
    <div class="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <p class="text-xs font-bold uppercase tracking-wide text-slate-400">
        {{ label }}
      </p>

      <p class="mt-2 text-2xl font-black text-slate-900">
        {{ value }}
      </p>
    </div>
  `,
};


const {
    patients,
} = useEHR();


const searchQuery =
    ref("");

const selected =
    ref<any>(null);


const loading =
    ref(false);

const error =
    ref("");


const timeline =
    ref<TimelineEvent[]>(
        [],
    );


const stats =
    ref<Record<string, number>>(
        {},
    );


const sections =
    ref<Record<string, any[]>>(
        {},
    );


const summary =
    ref("");

const generating =
    ref(false);


const timelineSearch =
    ref("");

const timelineFilter =
    ref("ALL");


const timelineFilters = [
    {
        value: "ALL",
        label: "All",
    },

    {
        value: "ENCOUNTER",
        label: "Encounters",
    },

    {
        value: "ADMISSION",
        label: "Admissions",
    },

    {
        value: "BHT",
        label: "BHT",
    },

    {
        value: "LAB",
        label: "Lab",
    },

    {
        value: "RADIOLOGY",
        label: "Radiology",
    },

    {
        value: "MEDICATION",
        label: "Medication",
    },

    {
        value: "SURGERY",
        label: "Surgery",
    },

    {
        value: "PROCEDURE",
        label: "Procedure",
    },
];


const filteredPatients =
    computed(
        () => {
            const term =
                searchQuery.value
                    .trim()
                    .toLowerCase();


            if (!term) {
                return patients.value;
            }


            return patients.value.filter(
                (
                    patient: any,
                ) =>
                    `${patient.firstName || ""} ${patient.lastName || ""} ${patient.patientNumber || ""} ${patient.nic || ""}`
                        .toLowerCase()
                        .includes(term),
            );
        },
    );


const filteredTimeline =
    computed(
        () => {
            const search =
                timelineSearch.value
                    .trim()
                    .toLowerCase();


            return timeline.value.filter(
                (event) => {
                    if (
                        timelineFilter.value !==
                        "ALL" &&
                        event.type !==
                        timelineFilter.value
                    ) {
                        return false;
                    }


                    if (!search) {
                        return true;
                    }


                    const haystack =
                        JSON.stringify({
                            type:
                                event.type,

                            title:
                                event.title,

                            subtitle:
                                event.subtitle,

                            status:
                                event.status,

                            department:
                                event.department,

                            admissionNumber:
                                event.admissionNumber,

                            details:
                                event.details,
                        }).toLowerCase();


                    return haystack.includes(
                        search,
                    );
                },
            );
        },
    );


const age =
    computed(
        () => {
            if (
                !selected.value
                    ?.dateOfBirth
            ) {
                return 0;
            }


            const date =
                new Date(
                    selected.value
                        .dateOfBirth,
                );


            if (
                Number.isNaN(
                    date.getTime(),
                )
            ) {
                return 0;
            }


            const now =
                new Date();


            let years =
                now.getFullYear() -
                date.getFullYear();


            const beforeBirthday =
                now.getMonth() <
                date.getMonth() ||
                (
                    now.getMonth() ===
                    date.getMonth() &&
                    now.getDate() <
                    date.getDate()
                );


            if (
                beforeBirthday
            ) {
                years -= 1;
            }


            return Math.max(
                0,
                years,
            );
        },
    );


const allergyNames =
    computed(
        () => {
            const allergies =
                selected.value
                    ?.allergies;


            if (
                !Array.isArray(
                    allergies,
                )
            ) {
                return [];
            }


            return [
                ...new Set(
                    allergies
                        .map(
                            (
                                allergy: any,
                            ) => {
                                if (
                                    typeof allergy ===
                                    "string"
                                ) {
                                    return allergy.trim();
                                }


                                return String(
                                    allergy?.name ||
                                    allergy?.allergy_name ||
                                    "",
                                ).trim();
                            },
                        )
                        .filter(
                            Boolean,
                        ),
                ),
            ];
        },
    );


function initial(
    value: any,
) {
    const text =
        String(
            value || "",
        ).trim();


    return text
        ? text[0].toUpperCase()
        : "";
}


function selectPatient(
    patient: any,
) {
    selected.value =
        patient;

    summary.value =
        "";

    error.value =
        "";

    timelineSearch.value =
        "";

    timelineFilter.value =
        "ALL";
}


async function loadMedicalRecord(
    patientId: string,
) {
    loading.value =
        true;

    error.value =
        "";


    try {
        const response =
            await apiGet<MedicalRecordResponse>(
                `/medical-records/patients/${patientId}`,
            );


        const data =
            response?.data;


        if (!data) {
            throw new Error(
                "The medical record response was empty.",
            );
        }


        timeline.value =
            Array.isArray(
                data.timeline,
            )
                ? data.timeline
                : [];


        stats.value =
            data.stats ||
            {};


        sections.value =
            data.sections ||
            {};
    } catch (
    requestError
    ) {
        timeline.value =
            [];

        stats.value =
            {};

        sections.value =
            {};


        error.value =
            requestError instanceof Error
                ? requestError.message
                : "Unable to load the patient's longitudinal EHR.";
    } finally {
        loading.value =
            false;
    }
}


async function reload() {
    if (
        !selected.value
    ) {
        return;
    }


    await loadMedicalRecord(
        String(
            selected.value.id,
        ),
    );
}


watch(
    selected,
    async (
        patient,
    ) => {
        if (!patient) {
            timeline.value =
                [];

            stats.value =
                {};

            sections.value =
                {};

            return;
        }


        await loadMedicalRecord(
            String(
                patient.id,
            ),
        );
    },
);


function generateSummary() {
    if (
        !selected.value ||
        !timeline.value.length
    ) {
        return;
    }


    generating.value =
        true;


    window.setTimeout(
        () => {
            const patient =
                selected.value;


            const events =
                timeline.value;


            const admissions =
                events.filter(
                    (event) =>
                        event.type ===
                        "ADMISSION",
                );


            const diagnoses =
                uniqueValues(
                    events
                        .filter(
                            (event) =>
                                [
                                    "CONDITION",
                                    "BHT",
                                    "OPD",
                                    "CLINIC",
                                    "EMERGENCY",
                                    "SURGERY",
                                    "TREATMENT",
                                ].includes(
                                    event.type,
                                ),
                        )
                        .flatMap(
                            (event) => [
                                event.subtitle,

                                event.details
                                    ?.diagnosis,

                                event.details
                                    ?.diagnosisSummary,

                                event.details
                                    ?.preoperativeDiagnosis,

                                event.details
                                    ?.postoperativeDiagnosis,
                            ],
                        ),
                ).slice(
                    0,
                    8,
                );


            const activeMedications =
                uniqueValues(
                    events
                        .filter(
                            (event) =>
                                event.type ===
                                "MEDICATION",
                        )
                        .filter(
                            (event) =>
                                [
                                    "ORDERED",
                                    "PARTIALLY_DISPENSED",
                                    "DISPENSED",
                                ].includes(
                                    String(
                                        event.status ||
                                        "",
                                    ).toUpperCase(),
                                ),
                        )
                        .map(
                            (
                                event,
                            ) =>
                                event.title,
                        ),
                ).slice(
                    0,
                    8,
                );


            const procedures =
                events.filter(
                    (event) =>
                        event.type ===
                        "SURGERY" ||
                        event.type ===
                        "PROCEDURE",
                );


            const investigations =
                events.filter(
                    (event) =>
                        event.type ===
                        "LAB" ||
                        event.type ===
                        "RADIOLOGY",
                );


            const devices =
                events
                    .filter(
                        (event) =>
                            event.type ===
                            "DEVICE",
                    )
                    .map(
                        (event) =>
                            event.title +
                            (
                                event.details
                                    ?.bodySite
                                    ? ` (${event.details.bodySite})`
                                    : ""
                            ),
                    );


            const fractures =
                events
                    .filter(
                        (event) =>
                            event.type ===
                            "FRACTURE",
                    )
                    .map(
                        (event) =>
                            event.title,
                    );


            const latest =
                events[0];


            const details: string[] =
                [];


            details.push(
                `${patient.firstName} ${patient.lastName} is an adult patient aged ${age.value} years with blood group ${patient.bloodGroup || "not recorded"}.`,
            );


            details.push(
                `The longitudinal EHR contains ${events.length} clinical event(s), including ${admissions.length} admission event(s), ${investigations.length} investigation record(s), and ${procedures.length} surgery/procedure record(s).`,
            );


            details.push(
                diagnoses.length
                    ? `Documented diagnoses and clinical problems include ${diagnoses.join(", ")}.`
                    : "No diagnosis summary was available in the loaded source records.",
            );


            details.push(
                activeMedications.length
                    ? `Medication history includes ${activeMedications.join(", ")}.`
                    : "No currently ordered medication was identified in the loaded medication history.",
            );


            if (
                fractures.length
            ) {
                details.push(
                    `Historical fracture records include ${fractures.join(", ")}.`,
                );
            }


            if (
                devices.length
            ) {
                details.push(
                    `Documented medical devices include ${devices.join(", ")}.`,
                );
            }


            if (
                latest
            ) {
                details.push(
                    `The most recent loaded event is ${latest.title}${latest.date ? ` on ${formatDate(latest.date)}` : ""}.`,
                );
            }


            summary.value =
                details.join(
                    " ",
                );


            generating.value =
                false;
        },
        450,
    );
}


function uniqueValues(
    values: any[],
) {
    return [
        ...new Set(
            values
                .map(
                    (value) =>
                        String(
                            value ??
                            "",
                        ).trim(),
                )
                .filter(
                    Boolean,
                ),
        ),
    ];
}


function eventIcon(
    type: string,
) {
    const icons: Record<
        string,
        string
    > = {
        ENCOUNTER: "E",
        ADMISSION: "A",
        DISCHARGE: "D",
        OPD: "O",
        CLINIC: "C",
        EMERGENCY: "!",
        BHT: "B",
        TREATMENT: "T",
        LAB: "L",
        RADIOLOGY: "R",
        MEDICATION: "M",
        SURGERY: "S",
        PROCEDURE: "P",
        FRACTURE: "F",
        OBSERVATION: "O",
        CONDITION: "C",
        DENTAL: "D",
        DEVICE: "V",
    };


    return (
        icons[type] ||
        "•"
    );
}


function eventDetailLines(
    event: TimelineEvent,
) {
    const d =
        event.details ||
        {};


    const lines: {
        label: string;
        value: string;
    }[] = [];


    const add = (
        label: string,
        value: any,
    ) => {
        if (
            value === null ||
            value === undefined ||
            value === "" ||
            typeof value ===
            "boolean"
        ) {
            return;
        }


        if (
            typeof value ===
            "object"
        ) {
            return;
        }


        lines.push({
            label,
            value:
                String(
                    value,
                ),
        });
    };


    switch (
    event.type
    ) {
        case "BHT":
            add(
                "Diagnosis",
                d.diagnosis,
            );

            add(
                "Assessment",
                d.assessment,
            );

            add(
                "Plan",
                d.plan,
            );

            add(
                "Recorded by",
                d.recordedByName,
            );


            if (
                d.vitals
            ) {
                const vitalParts =
                    [
                        d.vitals
                            .temperatureC
                            ? `Temp ${d.vitals.temperatureC} °C`
                            : "",

                        d.vitals
                            .pulseBpm
                            ? `Pulse ${d.vitals.pulseBpm} bpm`
                            : "",

                        d.vitals
                            .spo2Percent
                            ? `SpO₂ ${d.vitals.spo2Percent}%`
                            : "",

                        d.vitals
                            .systolicBp &&
                            d.vitals
                                .diastolicBp
                            ? `BP ${d.vitals.systolicBp}/${d.vitals.diastolicBp}`
                            : "",
                    ].filter(
                        Boolean,
                    );


                add(
                    "Vitals",
                    vitalParts.join(
                        " · ",
                    ),
                );
            }

            break;


        case "LAB":
        case "RADIOLOGY":
            add(
                "Result",
                d.resultSummary,
            );

            add(
                "Value",
                d.resultValue,
            );

            add(
                "Reference range",
                d.referenceRange,
            );

            add(
                "Priority",
                d.priority,
            );

            add(
                "Performed by",
                d.performedByName,
            );

            add(
                "Verified by",
                d.verifiedByName,
            );

            add(
                "Clinical notes",
                d.clinicalNotes,
            );

            break;


        case "MEDICATION":
            add(
                "Dosage",
                d.dosage,
            );

            add(
                "Route",
                d.route,
            );

            add(
                "Frequency",
                d.frequency,
            );

            add(
                "Indication",
                d.indication,
            );

            add(
                "Instructions",
                d.instructions,
            );

            add(
                "Dispensed",
                d.totalDispensedQuantity !==
                    null &&
                    d.totalDispensedQuantity !==
                    undefined
                    ? `${d.totalDispensedQuantity} ${d.quantityUnit || ""}`.trim()
                    : "",
            );

            add(
                "Prescribed by",
                d.prescriberName,
            );

            break;


        case "SURGERY":
            add(
                "Body site",
                d.bodySite,
            );

            add(
                "Laterality",
                d.laterality,
            );

            add(
                "Pre-op diagnosis",
                d.preoperativeDiagnosis,
            );

            add(
                "Post-op diagnosis",
                d.postoperativeDiagnosis,
            );

            add(
                "Findings",
                d.findings,
            );

            add(
                "Complications",
                d.complications,
            );

            add(
                "Surgeon",
                d.surgeonName,
            );

            break;


        case "PROCEDURE":
            add(
                "Body site",
                d.bodySite,
            );

            add(
                "Laterality",
                d.laterality,
            );

            add(
                "Indication",
                d.indication,
            );

            add(
                "Findings",
                d.findings,
            );

            add(
                "Outcome",
                d.outcome,
            );

            add(
                "Performed by",
                d.performedByName,
            );

            break;


        case "TREATMENT":
            add(
                "Treatment type",
                d.treatmentType,
            );

            add(
                "Body site",
                d.bodySite,
            );

            add(
                "Laterality",
                d.laterality,
            );

            add(
                "Outcome",
                d.outcome,
            );

            add(
                "Complications",
                d.complications,
            );

            add(
                "Performed by",
                d.performedByName,
            );

            break;


        case "ADMISSION":
        case "DISCHARGE":
            add(
                "Admission diagnosis",
                d.admissionDiagnosis,
            );

            add(
                "Discharge diagnosis",
                d.dischargeDiagnosis,
            );

            add(
                "Discharge summary",
                d.dischargeSummary,
            );

            add(
                "Ward",
                d.wardName,
            );

            add(
                "Bed",
                d.bedNumber,
            );

            add(
                "Doctor",
                d.doctorName,
            );

            break;


        case "FRACTURE":
            add(
                "Fracture type",
                d.fractureType,
            );

            add(
                "Treatment",
                d.treatmentDescription,
            );

            add(
                "Healed date",
                d.healedDate,
            );

            add(
                "Notes",
                d.notes,
            );

            break;


        case "OBSERVATION":
            add(
                "Observation",
                d.observationValue,
            );

            add(
                "Body site",
                d.bodySite,
            );

            add(
                "Laterality",
                d.laterality,
            );

            add(
                "Recorded by",
                d.recordedByName,
            );

            add(
                "Notes",
                d.notes,
            );

            break;


        case "CONDITION":
            add(
                "Condition",
                d.conditionName,
            );

            add(
                "Severity",
                d.severity,
            );

            add(
                "Status",
                event.status,
            );

            add(
                "Notes",
                d.notes,
            );

            break;


        case "DENTAL":
            add(
                "Tooth",
                d.toothNumber,
            );

            add(
                "Condition",
                d.condition,
            );

            add(
                "Treatment",
                d.treatment,
            );

            add(
                "Filling",
                d.fillingType,
            );

            add(
                "Recorded by",
                d.recordedByName,
            );

            add(
                "Notes",
                d.notes,
            );

            break;


        case "DEVICE":
            add(
                "Device type",
                d.deviceType,
            );

            add(
                "Body site",
                d.bodySite,
            );

            add(
                "Laterality",
                d.laterality,
            );

            add(
                "Manufacturer",
                d.manufacturer,
            );

            add(
                "Model",
                d.modelNumber,
            );

            add(
                "Implanted",
                d.implantationDate,
            );

            add(
                "Removed",
                d.removalDate,
            );

            break;


        case "EMERGENCY":
            add(
                "Arrival mode",
                d.arrivalMode,
            );

            add(
                "Triage",
                d.triageLevel,
            );

            add(
                "Chief complaint",
                d.chiefComplaint,
            );

            add(
                "Initial condition",
                d.initialCondition,
            );

            add(
                "Assigned doctor",
                d.assignedDoctorName,
            );

            add(
                "Identified at",
                d.identifiedAt,
            );

            break;


        case "OPD":
            add(
                "Chief complaint",
                d.chiefComplaint,
            );

            add(
                "Diagnosis",
                d.diagnosisSummary,
            );

            add(
                "Clinical notes",
                d.clinicalNotes,
            );

            add(
                "Doctor",
                d.doctorName,
            );

            break;


        case "CLINIC":
            add(
                "Clinic",
                d.clinicName,
            );

            add(
                "Specialty",
                d.specialty,
            );

            add(
                "Reason",
                d.reasonForVisit,
            );

            add(
                "Diagnosis",
                d.diagnosisSummary,
            );

            add(
                "Doctor",
                d.doctorName,
            );

            break;


        case "ENCOUNTER":
            add(
                "Chief complaint",
                d.chiefComplaint,
            );

            add(
                "Notes",
                d.notes,
            );

            add(
                "Attending clinician",
                d.attendingUserName,
            );

            break;


        default:
            break;
    }


    return lines.slice(
        0,
        6,
    );
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
        return String(value);
    }


    return new Intl.DateTimeFormat(
        "en-LK",
        {
            year:
                "numeric",

            month:
                "short",

            day:
                "2-digit",

            hour:
                "2-digit",

            minute:
                "2-digit",
        },
    ).format(date);
}
</script>