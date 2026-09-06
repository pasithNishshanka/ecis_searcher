<template>
  <div>
    <PageHeader
      eyebrow="Emergency Clinical Identity Search"
      title="ECIS Search"
      description="Search existing hospital EHR information and rank possible patient candidates for authorized staff review."
    >
      <StatusBadge
        tone="info"
        label="Existing EHR only"
      />
    </PageHeader>

    <!-- SEARCH CONTEXT -->
    <div
      class="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div
        class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p
            class="text-xs font-bold uppercase tracking-wide text-slate-400"
          >
            Search context
          </p>

          <p class="text-sm font-bold text-slate-700">
            {{
              emergencyCaseId
                ? `Emergency Case #${emergencyCaseId}`
                : "Standalone EHR Search"
            }}
          </p>

          <p class="mt-1 text-xs text-slate-400">
            {{
              emergencyCaseId
                ? "Search linked to an unidentified emergency case."
                : "Search existing EHR records directly using available clues."
            }}
          </p>
        </div>

        <RouterLink
          v-if="emergencyCaseId"
          to="/emergency"
        >
          <BaseButton
            variant="secondary"
            size="sm"
          >
            Back to Emergency Cases
          </BaseButton>
        </RouterLink>
      </div>
    </div>

    <div class="grid gap-6 xl:grid-cols-[320px_1fr]">
      <!-- SEARCH FILTERS -->
      <aside class="card p-5">
        <div
          class="flex items-center justify-between"
        >
          <h2 class="section-title text-base">
            Search filters
          </h2>

          <BaseButton
            variant="ghost"
            size="sm"
            @click="clear"
          >
            Clear all
          </BaseButton>
        </div>

        <div class="mt-5 space-y-4">
          <!-- AGE -->
          <RangeField
            label="Age"
            v-model:min-value="f.ageMin"
            v-model:max-value="f.ageMax"
            :min="0"
            :max="120"
            hint="Years"
          />

          <!-- HEIGHT -->
          <RangeField
            label="Height"
            v-model:min-value="f.heightMin"
            v-model:max-value="f.heightMax"
            :min="30"
            :max="250"
            :step="0.1"
            hint="cm"
          />

          <!-- WEIGHT -->
          <RangeField
            label="Weight"
            v-model:min-value="f.weightMin"
            v-model:max-value="f.weightMax"
            :min="1"
            :max="400"
            :step="0.1"
            hint="kg"
          />

          <!-- BLOOD GROUP -->
          <FormField label="Blood group">
            <BaseSelect
              v-model="f.bloodGroup"
            >
              <option value="">
                Any
              </option>

              <option
                v-for="group in groups"
                :key="group"
                :value="group"
              >
                {{ group }}
              </option>
            </BaseSelect>
          </FormField>

          <!-- GENDER -->
          <FormField
            label="Gender / observed sex"
          >
            <BaseSelect
              v-model="f.gender"
            >
              <option value="">
                Any
              </option>

              <option value="Male">
                Male
              </option>

              <option value="Female">
                Female
              </option>

              <option value="Other">
                Other
              </option>
            </BaseSelect>
          </FormField>

          <!-- NAME -->
          <FormField
            label="Partial name / initials"
          >
            <BaseInput
              v-model="f.partialName"
              placeholder="Kasun / Perera / K"
            />
          </FormField>

          <!-- PHONE -->
          <FormField label="Phone digits">
            <BaseInput
              v-model="f.phoneFragment"
              placeholder="4567"
            />
          </FormField>

          <!-- WORKPLACE -->
          <FormField
            label="Workplace / occupation"
          >
            <BaseInput
              v-model="f.workplace"
              placeholder="Engineer"
            />
          </FormField>

          <!-- SURGERY -->
          <FormField
            label="Previous surgery"
          >
            <BaseInput
              v-model="f.previousSurgery"
              placeholder="fracture fixation"
            />
          </FormField>

          <!-- FRACTURE -->
          <FormField label="Old fracture">
            <BaseInput
              v-model="f.fracture"
              placeholder="humerus / femur"
            />
          </FormField>

          <!-- DEVICE -->
          <FormField
            label="Implant / device"
          >
            <BaseInput
              v-model="f.implantOrDevice"
              placeholder="orthopedic plate"
            />
          </FormField>

          <!-- DENTAL -->
          <FormField label="Dental clue">
            <BaseInput
              v-model="f.dentalClue"
              placeholder="tooth 11 / crown"
            />
          </FormField>

          <!-- OBSERVATION -->
          <FormField
            label="Clinical observation"
          >
            <BaseInput
              v-model="f.clinicalObservation"
              placeholder="birthmark / scar / tattoo"
            />
          </FormField>

          <!-- TREATMENT -->
          <FormField
            label="Previous treatment"
          >
            <BaseInput
              v-model="f.treatment"
              placeholder="physiotherapy / medication"
            />
          </FormField>

          <!-- INVESTIGATION -->
          <FormField
            label="Investigation"
          >
            <BaseInput
              v-model="f.investigation"
              placeholder="X-ray / ECG / blood test"
            />
          </FormField>

          <!-- PREVIOUS SURGERY EXISTS -->
          <label
            class="flex items-center gap-3 rounded-xl border border-slate-200 p-3"
          >
            <input
              v-model="f.hasSurgery"
              type="checkbox"
              class="size-4 accent-teal-700"
            />

            <span class="text-sm font-bold">
              Previous surgery
            </span>
          </label>

          <!-- SEARCH -->
          <BaseButton
            block
            :disabled="loading"
            @click="run"
          >
            <template #icon>
              <Search :size="16" />
            </template>

            {{
              loading
                ? "Searching..."
                : "Search EHR"
            }}
          </BaseButton>
        </div>
      </aside>

      <!-- RESULTS -->
      <main>
        <div
          class="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
        >
          <div>
            <b>{{ results.length }}</b>
            candidate{{
              results.length === 1
                ? ""
                : "s"
            }}
            found

            <p class="text-xs text-slate-400">
              Candidate score supports staff review;
              it does not automatically confirm identity.
            </p>
          </div>

          <BaseSelect
            v-model="sort"
            class="w-40"
          >
            <option value="score">
              Best match
            </option>

            <option value="name">
              Name
            </option>
          </BaseSelect>
        </div>

        <!-- ERROR -->
        <div
          v-if="error"
          class="card mb-4 border border-red-200 bg-red-50 p-5"
        >
          <p class="font-bold text-red-700">
            {{ error }}
          </p>
        </div>

        <!-- LOADING -->
        <div
          v-if="loading"
          class="card p-12 text-center"
        >
          <p class="text-lg font-bold">
            Searching EHR...
          </p>

          <p
            class="mt-1 text-sm text-slate-400"
          >
            Matching available clinical and demographic evidence.
          </p>
        </div>

        <!-- INITIAL STATE -->
        <div
          v-else-if="
            !error &&
            !hasSearched
          "
          class="card p-12 text-center"
        >
          <p class="text-lg font-bold">
            Ready for ECIS search
          </p>

          <p
            class="mt-1 text-sm text-slate-400"
          >
            Enter one or more available patient clues
            and search the existing EHR.
          </p>
        </div>

        <!-- NO RESULTS -->
        <div
          v-else-if="
            !error &&
            hasSearched &&
            !results.length
          "
          class="card p-12 text-center"
        >
          <p class="text-lg font-bold">
            No candidates found
          </p>

          <p
            class="mt-1 text-sm text-slate-400"
          >
            Try widening the Min / Max ranges
            or removing a filter.
          </p>
        </div>

        <!-- CANDIDATES -->
        <div
          v-else
          class="space-y-3"
        >
          <article
            v-for="candidate in sorted"
            :key="
              candidate.patientId
            "
            class="card p-5"
          >
            <div
              class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <!-- PATIENT -->
              <div class="flex gap-3">
                <div class="avatar">
                  {{
                    firstInitial(
                      candidate.name
                    )
                  }}{{
                    lastInitial(
                      candidate.name
                    )
                  }}
                </div>

                <div>
                  <h3 class="font-bold">
                    {{
                      candidate.name
                    }}

                    <StatusBadge
                      :label="
                        candidate.patientNumber
                      "
                    />
                  </h3>

                  <p
                    class="mt-1 text-xs text-slate-400"
                  >
                    Age
                    {{
                      candidate.age ??
                      age(
                        candidate.dateOfBirth
                      )
                    }}
                    ·
                    {{
                      candidate.gender ||
                      "Unknown"
                    }}
                    ·
                    {{
                      candidate.bloodGroup ||
                      "Unknown"
                    }}
                    ·
                    {{
                      candidate.heightCm ??
                      "-"
                    }}
                    cm ·
                    {{
                      candidate.weightKg ??
                      "-"
                    }}
                    kg
                  </p>

                  <p
                    v-if="
                      candidate.occupation
                    "
                    class="mt-1 text-xs text-slate-400"
                  >
                    Occupation:
                    {{
                      candidate.occupation
                    }}
                  </p>

                  <p
                    v-if="
                      candidate.hospitalName
                    "
                    class="mt-1 text-xs text-slate-400"
                  >
                    Hospital:
                    {{
                      candidate.hospitalName
                    }}
                  </p>

                  <!-- EVIDENCE -->
                  <div
                    v-if="
                      candidate.evidence?.length
                    "
                    class="mt-3 space-y-2"
                  >
                    <div
                      v-for="(
                        evidence,
                        index
                      ) in candidate.evidence"
                      :key="
                        `${candidate.patientId}-${index}`
                      "
                      class="rounded-lg bg-slate-50 px-3 py-2"
                    >
                      <div
                        class="flex flex-wrap items-center gap-2"
                      >
                        <StatusBadge
                          tone="info"
                          :label="
                            evidence.type
                          "
                        />

                        <span
                          class="text-xs text-slate-600"
                        >
                          {{
                            evidence.description
                          }}
                        </span>
                      </div>

                      <p
                        class="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                      >
                        Source:
                        {{
                          evidence.sourceTable
                        }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- SCORE -->
              <div
                class="flex items-center gap-4"
              >
                <div class="text-right">
                  <p
                    class="text-3xl font-black text-teal-700"
                  >
                    {{
                      scorePercent(
                        candidate.score
                      )
                    }}%
                  </p>

                  <p
                    class="text-[10px] font-bold uppercase text-slate-400"
                  >
                    match score
                  </p>
                </div>

                <RouterLink
                  :to="`/patients/${candidate.patientId}`"
                >
                  <BaseButton
                    variant="secondary"
                  >
                    Review EHR
                    <ArrowRight
                      :size="15"
                    />
                  </BaseButton>
                </RouterLink>
              </div>
            </div>
          </article>
        </div>

        <!-- SAFETY -->
        <div
          class="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
        >
          <b>Clinical safety:</b>
          ECIS is a candidate-search and decision-support
          workflow. Authorized staff must verify identity
          before confirming or merging a record.
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  reactive,
  ref,
} from "vue";

import {
  RouterLink,
  useRoute,
} from "vue-router";

import {
  ArrowRight,
  Search,
} from "lucide-vue-next";

import PageHeader from "../components/PageHeader.vue";
import BaseButton from "../components/ui/BaseButton.vue";
import BaseInput from "../components/ui/BaseInput.vue";
import BaseSelect from "../components/ui/BaseSelect.vue";
import StatusBadge from "../components/ui/StatusBadge.vue";
import FormField from "../components/forms/FormField.vue";
import RangeField from "../components/forms/RangeField.vue";

import { apiPost } from "../services/api";

interface BackendEvidence {
  type: string;
  description: string;
  sourceTable: string;
}

interface BackendCandidate {
  patientId: number;
  patientNumber: string;
  name: string;
  dateOfBirth: string | null;
  age: number | null;
  gender: string | null;
  bloodGroup: string | null;
  heightCm: number | null;
  weightKg: number | null;
  primaryPhone: string | null;
  occupation: string | null;
  nationality: string | null;
  hospitalId: number;
  hospitalName: string | null;
  score: number;
  evidence: BackendEvidence[];
}

const route = useRoute();

/*
 * Emergency case is OPTIONAL.
 *
 * Direct ECIS:
 * /ecis
 *
 * Case-linked ECIS:
 * /ecis?emergencyCaseId=21
 */
const emergencyCaseId = computed(() => {
  const value =
    route.query.emergencyCaseId;

  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return String(value || "");
});

const groups = [
  "O+",
  "O-",
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
];

const f = reactive({
  ageMin:
    undefined as
      | number
      | undefined,

  ageMax:
    undefined as
      | number
      | undefined,

  heightMin:
    undefined as
      | number
      | undefined,

  heightMax:
    undefined as
      | number
      | undefined,

  weightMin:
    undefined as
      | number
      | undefined,

  weightMax:
    undefined as
      | number
      | undefined,

  bloodGroup: "",
  gender: "",

  partialName: "",
  phoneFragment: "",
  workplace: "",

  previousSurgery: "",
  fracture: "",
  implantOrDevice: "",

  dentalClue: "",
  clinicalObservation: "",
  treatment: "",
  investigation: "",

  hasSurgery: false,
});

const results =
  ref<BackendCandidate[]>(
    [],
  );

const loading =
  ref(false);

const error =
  ref("");

const hasSearched =
  ref(false);

const sort =
  ref("score");

const sorted =
  computed(() => {
    return [
      ...results.value,
    ].sort(
      (a, b) => {
        if (
          sort.value ===
          "name"
        ) {
          return String(
            a.name || ""
          ).localeCompare(
            String(
              b.name || ""
            )
          );
        }

        return (
          (Number(
            b.score
          ) || 0) -
          (Number(
            a.score
          ) || 0)
        );
      },
    );
  });

async function run() {
  error.value = "";

  const searchCriteria: Record<
    string,
    unknown
  > = {};

  if (
    f.ageMin !== undefined
  ) {
    searchCriteria.ageMin =
      f.ageMin;
  }

  if (
    f.ageMax !== undefined
  ) {
    searchCriteria.ageMax =
      f.ageMax;
  }

  if (
    f.heightMin !== undefined
  ) {
    searchCriteria.heightMin =
      f.heightMin;
  }

  if (
    f.heightMax !== undefined
  ) {
    searchCriteria.heightMax =
      f.heightMax;
  }

  if (
    f.weightMin !== undefined
  ) {
    searchCriteria.weightMin =
      f.weightMin;
  }

  if (
    f.weightMax !== undefined
  ) {
    searchCriteria.weightMax =
      f.weightMax;
  }

  if (
    f.bloodGroup
  ) {
    searchCriteria.bloodGroup =
      f.bloodGroup;
  }

  if (f.gender) {
    searchCriteria.gender =
      f.gender;
  }

  if (
    f.partialName.trim()
  ) {
    searchCriteria.partialName =
      f.partialName.trim();
  }

  if (
    f.phoneFragment.trim()
  ) {
    searchCriteria.phoneFragment =
      f.phoneFragment.trim();
  }

  if (
    f.workplace.trim()
  ) {
    searchCriteria.workplace =
      f.workplace.trim();
  }

  if (
    f.previousSurgery.trim()
  ) {
    searchCriteria.previousSurgery =
      f.previousSurgery.trim();
  }

  if (
    f.fracture.trim()
  ) {
    searchCriteria.fracture =
      f.fracture.trim();
  }

  if (
    f.implantOrDevice.trim()
  ) {
    searchCriteria.implantOrDevice =
      f.implantOrDevice.trim();
  }

  if (
    f.dentalClue.trim()
  ) {
    searchCriteria.dentalClue =
      f.dentalClue.trim();
  }

  if (
    f.clinicalObservation.trim()
  ) {
    searchCriteria.clinicalObservation =
      f.clinicalObservation.trim();
  }

  if (
    f.treatment.trim()
  ) {
    searchCriteria.treatment =
      f.treatment.trim();
  }

  if (
    f.investigation.trim()
  ) {
    searchCriteria.investigation =
      f.investigation.trim();
  }

  /*
   * Previous surgery checkbox:
   * The backend currently searches using previousSurgery.
   * Therefore the checkbox alone does not create a fake
   * unsupported search criterion.
   */
  if (
    f.hasSurgery &&
    !f.previousSurgery.trim()
  ) {
    error.value =
      "Enter a previous surgery clue or uncheck Previous surgery.";

    results.value = [];
    hasSearched.value =
      false;

    return;
  }

  if (
    Object.keys(
      searchCriteria,
    ).length === 0
  ) {
    error.value =
      "Enter at least one search clue before searching.";

    results.value = [];
    hasSearched.value =
      false;

    return;
  }

  loading.value = true;
  hasSearched.value =
    true;

  try {
    const payload: Record<
      string,
      unknown
    > = {
      ...searchCriteria,
    };

    /*
     * Optional emergency context.
     */
    if (
      emergencyCaseId.value
    ) {
      payload.emergencyCaseId =
        Number(
          emergencyCaseId.value,
        );
    }

    const response =
      await apiPost<{
        success?: boolean;
        candidates?: BackendCandidate[];
        results?: BackendCandidate[];
        data?: BackendCandidate[];
      }>(
        "/ecis/search",
        payload,
      );

    results.value =
      response?.candidates ||
      response?.results ||
      response?.data ||
      [];
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "ECIS search failed.";

    results.value = [];
  } finally {
    loading.value = false;
  }
}

function clear() {
  Object.assign(f, {
    ageMin: undefined,
    ageMax: undefined,

    heightMin: undefined,
    heightMax: undefined,

    weightMin: undefined,
    weightMax: undefined,

    bloodGroup: "",
    gender: "",

    partialName: "",
    phoneFragment: "",
    workplace: "",

    previousSurgery: "",
    fracture: "",
    implantOrDevice: "",

    dentalClue: "",
    clinicalObservation: "",
    treatment: "",
    investigation: "",

    hasSurgery: false,
  });

  results.value = [];
  error.value = "";
  hasSearched.value =
    false;
}

function age(
  dateOfBirth:
    | string
    | null
    | undefined,
) {
  if (!dateOfBirth) {
    return "-";
  }

  const birthDate =
    new Date(
      dateOfBirth,
    );

  if (
    Number.isNaN(
      birthDate.getTime(),
    )
  ) {
    return "-";
  }

  return Math.floor(
    (Date.now() -
      birthDate.getTime()) /
      31557600000,
  );
}

function firstInitial(
  name: string,
) {
  return (
    name
      ?.trim()
      .charAt(0)
      .toUpperCase() ||
    "?"
  );
}

function lastInitial(
  name: string,
) {
  const parts =
    name
      ?.trim()
      .split(/\s+/)
      .filter(Boolean) ||
    [];

  if (
    parts.length < 2
  ) {
    return "";
  }

  return (
    parts[
      parts.length - 1
    ]?.charAt(0)
      .toUpperCase() ||
    ""
  );
}

function scorePercent(
  score: number,
) {
  return Math.min(
    Math.max(
      Number(score) || 0,
      0,
    ),
    99,
  );
}
</script>