<template>
  <div>
    <PageHeader
      eyebrow="Emergency Clinical Identity Search"
      title="ECIS Search"
      description="Search existing hospital EHR information and rank possible patient candidates for authorized staff review."
    >
      <StatusBadge tone="info" label="Existing EHR only" />
    </PageHeader>

    <div class="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-wide text-slate-400">
            Emergency case
          </p>
          <p class="text-sm font-bold text-slate-700">
            {{ emergencyCaseId || "Not selected" }}
          </p>
        </div>

        <RouterLink to="/emergency">
          <BaseButton variant="secondary" size="sm">
            Back to Emergency Cases
          </BaseButton>
        </RouterLink>
      </div>
    </div>

    <div class="grid gap-6 xl:grid-cols-[320px_1fr]">
      <aside class="card p-5">
        <div class="flex items-center justify-between">
          <h2 class="section-title text-base">Search filters</h2>
          <BaseButton variant="ghost" size="sm" @click="clear">
            Clear all
          </BaseButton>
        </div>

        <div class="mt-5 space-y-4">
          <RangeField label="Age" v-model:min-value="f.ageMin" v-model:max-value="f.ageMax" :min="0" :max="120" hint="Years" />
          <RangeField label="Height" v-model:min-value="f.heightMin" v-model:max-value="f.heightMax" :min="30" :max="250" :step="0.1" hint="cm" />
          <RangeField label="Weight" v-model:min-value="f.weightMin" v-model:max-value="f.weightMax" :min="1" :max="400" :step="0.1" hint="kg" />

          <FormField label="Blood group">
            <BaseSelect v-model="f.bloodGroup">
              <option value="">Any</option>
              <option v-for="x in groups" :key="x">{{ x }}</option>
            </BaseSelect>
          </FormField>

          <FormField label="Province">
            <BaseSelect v-model="f.province">
              <option value="">Any</option>
              <option v-for="x in provinces" :key="x">{{ x }}</option>
            </BaseSelect>
          </FormField>

          <FormField label="District">
            <BaseInput v-model="f.district" placeholder="Colombo" />
          </FormField>

          <FormField label="Gender / observed sex">
            <BaseSelect v-model="f.gender">
              <option value="">Any</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </BaseSelect>
          </FormField>

          <FormField label="Partial name / initials">
            <BaseInput v-model="f.name" placeholder="K / Pasi / Kasun" />
          </FormField>

          <FormField label="Phone digits">
            <BaseInput v-model="f.phoneDigits" placeholder="Ends in 4567" />
          </FormField>

          <FormField label="Workplace">
            <BaseInput v-model="f.workplace" placeholder="Phoenix" />
          </FormField>

          <FormField label="Previous procedure">
            <BaseInput v-model="f.procedure" placeholder="fracture fixation" />
          </FormField>

          <FormField label="Implant / device">
            <BaseInput v-model="f.implant" placeholder="orthopedic plate" />
          </FormField>

          <FormField label="Clinical finding">
            <BaseInput v-model="f.finding" placeholder="surgical scar" />
          </FormField>

          <FormField label="Body region">
            <BaseInput v-model="f.bodyRegion" placeholder="right arm" />
          </FormField>

          <FormField label="Missing body part">
            <BaseInput v-model="f.missingBodyPart" placeholder="left finger" />
          </FormField>

          <FormField label="Scar description">
            <BaseInput v-model="f.scar" placeholder="right arm scar" />
          </FormField>

          <FormField label="Birthmark">
            <BaseInput v-model="f.birthmark" />
          </FormField>

          <FormField label="Tattoo">
            <BaseInput v-model="f.tattoo" />
          </FormField>

          <FormField label="Old fracture">
            <BaseInput v-model="f.fracture" placeholder="humerus fracture" />
          </FormField>

          <label class="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
            <input v-model="f.hasSurgery" type="checkbox" class="size-4 accent-teal-700" />
            <span class="text-sm font-bold">Previous surgery</span>
          </label>

          <BaseButton block :disabled="loading" @click="run">
            <template #icon>
              <Search :size="16" />
            </template>
            {{ loading ? "Searching..." : "Apply filters" }}
          </BaseButton>
        </div>
      </aside>

      <main>
        <div class="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <b>{{ results.length }}</b>
            candidate{{ results.length === 1 ? "" : "s" }} found
            <p class="text-xs text-slate-400">
              Candidate score supports staff review; it does not automatically confirm identity.
            </p>
          </div>

          <BaseSelect v-model="sort" class="w-40">
            <option value="score">Best match</option>
            <option value="name">Name</option>
          </BaseSelect>
        </div>

        <div v-if="error" class="card mb-4 border border-red-200 bg-red-50 p-5">
          <p class="font-bold text-red-700">{{ error }}</p>
        </div>

        <div v-if="loading" class="card p-12 text-center">
          <p class="text-lg font-bold">Searching EHR...</p>
          <p class="mt-1 text-sm text-slate-400">
            Matching available clinical and demographic evidence.
          </p>
        </div>

        <div v-else-if="!error && !results.length" class="card p-12 text-center">
          <p class="text-lg font-bold">No candidates found</p>
          <p class="mt-1 text-sm text-slate-400">
            Try widening the Min / Max ranges or removing a filter.
          </p>
        </div>

        <div v-else class="space-y-3">
          <article v-for="r in sorted" :key="r.patient.id" class="card p-5">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div class="flex gap-3">
                <div class="avatar">
                  {{ (r.patient.firstName || "?")[0] }}{{ (r.patient.lastName || "?")[0] }}
                </div>

                <div>
                  <h3 class="font-bold">
                    {{ r.patient.firstName }} {{ r.patient.lastName }}
                    <StatusBadge :label="r.patient.patientNumber" />
                  </h3>

                  <p class="mt-1 text-xs text-slate-400">
                    Age {{ r.patient.age ?? age(r.patient.dateOfBirth) }} ·
                    {{ r.patient.gender || "Unknown" }} ·
                    {{ r.patient.bloodGroup || "Unknown" }} ·
                    {{ r.patient.heightCm ?? "-" }} cm ·
                    {{ r.patient.weightKg ?? "-" }} kg
                  </p>

                  <div v-if="r.evidence?.length" class="mt-3 flex flex-wrap gap-1.5">
                    <StatusBadge
                      v-for="e in r.evidence"
                      :key="`${e.type}-${e.description}`"
                      tone="info"
                    >
                      ✓ {{ e.description || e }}
                    </StatusBadge>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-4">
                <div class="text-right">
                  <p class="text-3xl font-black text-teal-700">
                    {{ scorePercent(r.score) }}%
                  </p>
                  <p class="text-[10px] font-bold uppercase text-slate-400">
                    match score
                  </p>
                </div>

                <RouterLink :to="`/patients/${r.patient.id}`">
                  <BaseButton variant="secondary">
                    Review EHR
                    <ArrowRight :size="15" />
                  </BaseButton>
                </RouterLink>
              </div>
            </div>
          </article>
        </div>

        <div class="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <b>Clinical safety:</b>
          ECIS is a candidate-search and decision-support workflow. Authorized staff must verify identity before confirming or merging a record.
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { ArrowRight, Search } from "lucide-vue-next";

import PageHeader from "../components/PageHeader.vue";
import BaseButton from "../components/ui/BaseButton.vue";
import BaseInput from "../components/ui/BaseInput.vue";
import BaseSelect from "../components/ui/BaseSelect.vue";
import StatusBadge from "../components/ui/StatusBadge.vue";
import FormField from "../components/forms/FormField.vue";
import RangeField from "../components/forms/RangeField.vue";
import { apiPost } from "../services/api";

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
  evidence: Array<{
    type: string;
    description: string;
    sourceTable: string;
  }>;
}

interface UiCandidate {
  patient: {
    id: number;
    patientNumber: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
    age: number | null;
    gender: string | null;
    bloodGroup: string | null;
    heightCm: number | null;
    weightKg: number | null;
  };
  score: number;
  evidence: BackendCandidate["evidence"];
}

const route = useRoute();

const emergencyCaseId = computed(() => {
  const value = route.query.emergencyCaseId;
  if (Array.isArray(value)) return value[0] || "";
  return String(value || "");
});

const groups = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
const provinces = ["Western Province", "Central Province", "Southern Province", "Northern Province"];

const f = reactive({
  ageMin: undefined as number | undefined,
  ageMax: undefined as number | undefined,
  heightMin: undefined as number | undefined,
  heightMax: undefined as number | undefined,
  weightMin: undefined as number | undefined,
  weightMax: undefined as number | undefined,
  bloodGroup: "",
  province: "",
  district: "",
  gender: "",
  name: "",
  phoneDigits: "",
  workplace: "",
  procedure: "",
  implant: "",
  finding: "",
  bodyRegion: "",
  missingBodyPart: "",
  scar: "",
  birthmark: "",
  tattoo: "",
  fracture: "",
  hasSurgery: false,
});

const results = ref<UiCandidate[]>([]);
const loading = ref(false);
const error = ref("");
const sort = ref("score");

const sorted = computed(() => {
  return [...results.value].sort((a, b) => {
    if (sort.value === "name") {
      return `${a.patient.firstName}${a.patient.lastName}`.localeCompare(
        `${b.patient.firstName}${b.patient.lastName}`,
      );
    }
    return (Number(b.score) || 0) - (Number(a.score) || 0);
  });
});

function toUiCandidate(candidate: BackendCandidate): UiCandidate {
  const parts = candidate.name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || "Unknown";
  const lastName = parts.join(" ");

  return {
    patient: {
      id: candidate.patientId,
      patientNumber: candidate.patientNumber,
      firstName,
      lastName,
      dateOfBirth: candidate.dateOfBirth,
      age: candidate.age,
      gender: candidate.gender,
      bloodGroup: candidate.bloodGroup,
      heightCm: candidate.heightCm,
      weightKg: candidate.weightKg,
    },
    score: candidate.score,
    evidence: candidate.evidence || [],
  };
}

async function run() {
  error.value = "";

  if (!emergencyCaseId.value) {
    error.value = "Open ECIS from an unidentified emergency case before searching.";
    results.value = [];
    return;
  }

  const searchCriteria: Record<string, unknown> = {};

  if (f.ageMin !== undefined) searchCriteria.ageMin = f.ageMin;
  if (f.ageMax !== undefined) searchCriteria.ageMax = f.ageMax;
  if (f.heightMin !== undefined) searchCriteria.heightMin = f.heightMin;
  if (f.heightMax !== undefined) searchCriteria.heightMax = f.heightMax;
  if (f.weightMin !== undefined) searchCriteria.weightMin = f.weightMin;

  if (f.weightMax !== undefined) searchCriteria.weightMax = f.weightMax;
  if (f.bloodGroup) searchCriteria.bloodGroup = f.bloodGroup;
  if (f.gender) searchCriteria.gender = f.gender;
  if (f.name.trim()) searchCriteria.partialName = f.name.trim();
  if (f.phoneDigits.trim()) searchCriteria.phoneFragment = f.phoneDigits.trim();
  if (f.workplace.trim()) searchCriteria.workplace = f.workplace.trim();
  if (f.procedure.trim()) searchCriteria.previousSurgery = f.procedure.trim();
  if (f.implant.trim()) searchCriteria.implantOrDevice = f.implant.trim();
  if (f.finding.trim()) searchCriteria.clinicalObservation = f.finding.trim();
  if (f.fracture.trim()) searchCriteria.fracture = f.fracture.trim();

  /*
   * The remaining descriptive fields are retained in the original UI.
   * They are not sent as unsupported backend criteria because the current
   * database search service does not expose matching rules for them yet.
   */

  if (f.hasSurgery && !searchCriteria.previousSurgery) {
    searchCriteria.previousSurgery = "";
  }

  loading.value = true;

  try {
    const response = await apiPost<{
      success: boolean;
      candidates: BackendCandidate[];
    }>("/ecis/search", {
      emergencyCaseId: Number(emergencyCaseId.value),
      ...searchCriteria,
    });

    results.value = (response.candidates || []).map(toUiCandidate);
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "ECIS search failed.";
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
    province: "",
    district: "",
    gender: "",
    name: "",
    phoneDigits: "",
    workplace: "",
    procedure: "",
    implant: "",
    finding: "",
    bodyRegion: "",
    missingBodyPart: "",
    scar: "",
    birthmark: "",
    tattoo: "",
    fracture: "",
    hasSurgery: false,
  });

  results.value = [];
  error.value = "";
}

function age(dateOfBirth: string | null | undefined) {
  if (!dateOfBirth) return "-";

  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return "-";

  return Math.floor((Date.now() - birthDate.getTime()) / 31557600000);
}

function scorePercent(score: number) {
  return Math.min(Math.max(Number(score) || 0, 0), 99);
}
</script>
