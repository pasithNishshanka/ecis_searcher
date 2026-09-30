<template>
  <div>
    <PageHeader
      eyebrow="Patient registry"
      title="Patients"
      description="Register each patient once and maintain the same permanent EHR throughout their care."
    >
      <div class="flex flex-wrap gap-2">
        <BaseButton variant="secondary" @click="openCentral = true">
          Find existing patient
        </BaseButton>
        <BaseButton @click="openRegisterModal">
          <template #icon><UserPlus :size="16" /></template>
          Register patient
        </BaseButton>
      </div>
    </PageHeader>


    <!-- ======================================================
         SEARCH
         ====================================================== -->

    <section class="card p-5">
      <div class="grid gap-3 md:grid-cols-[1fr_180px]">
        <BaseInput
          v-model="search"
          placeholder="Search name / Patient ID / NIC / phone"
        />

        <BaseSelect
          v-model="genderFilter"
        >
          <option value="">
            All gender
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
      </div>
    </section>


    <!-- ======================================================
         PATIENT TABLE
         ====================================================== -->

    <section class="card mt-6 overflow-hidden">
      <div class="border-b p-5">
        <div
          class="flex items-center justify-between"
        >
          <div>
            <h2 class="section-title">
              Registered patients
            </h2>

            <p class="muted mt-1">
              {{ filtered.length }}
              patient records
            </p>
          </div>
        </div>
      </div>


      <div class="overflow-x-auto">
        <table class="min-w-full">
          <thead class="bg-slate-50">
            <tr>
              <th
                class="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500"
              >
                Patient
              </th>

              <th
                class="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500"
              >
                DOB
              </th>

              <th
                class="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500"
              >
                Age
              </th>

              <th
                class="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500"
              >
                Blood
              </th>

              <th
                class="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500"
              >
                Location
              </th>

              <th
                class="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500"
              >
                Actions
              </th>
            </tr>
          </thead>


          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="patient in filtered"
              :key="patient.id"
              class="hover:bg-slate-50"
            >
              <td class="px-5 py-4">
                <div
                  class="flex items-center gap-3"
                >
                  <div class="avatar">
                    {{
                      patient.firstName
                        ?.charAt(0) || ""
                    }}{{
                      patient.lastName
                        ?.charAt(0) || ""
                    }}
                  </div>


                  <div>
                    <p class="font-bold">
                      {{
                        patient.firstName
                      }}
                      {{
                        patient.lastName
                      }}
                    </p>

                    <p
                      class="text-xs text-slate-400"
                    >
                      {{
                        patient.patientNumber
                      }}

                      <span
                        v-if="patient.nic"
                      >
                        ·
                        {{ patient.nic }}
                      </span>
                    </p>
                  </div>
                </div>
              </td>


              <td
                class="px-5 py-4 text-sm"
              >
                {{
                  formatDate(
                    patient.dateOfBirth,
                  )
                }}
              </td>


              <td
                class="px-5 py-4 text-sm font-bold"
              >
                {{
                  calculateAge(
                    patient.dateOfBirth,
                  ) ?? "—"
                }}
              </td>


              <td
                class="px-5 py-4 text-sm font-bold"
              >
                {{
                  patient.bloodGroup ||
                  "—"
                }}
              </td>


              <td
                class="px-5 py-4 text-sm"
              >
                {{
                  formatLocation(
                    patient,
                  )
                }}
              </td>


              <td class="px-5 py-4">
                <div
                  class="flex justify-end gap-2"
                >
                  <RouterLink
                    :to="`/patients/${patient.id}`"
                  >
                    <BaseButton
                      variant="secondary"
                      size="sm"
                    >
                      Open EHR
                    </BaseButton>
                  </RouterLink>


                  <BaseButton
                    variant="ghost"
                    size="sm"
                    @click="
                      startEdit(patient)
                    "
                  >
                    Edit
                  </BaseButton>
                </div>
              </td>
            </tr>


            <tr
              v-if="!filtered.length"
            >
              <td
                colspan="6"
                class="p-12 text-center text-sm text-slate-400"
              >
                {{
                  loading
                    ? "Loading registered patients..."
                    : "No patients found."
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>


    <!-- ======================================================
         TOAST
         ====================================================== -->

    <AppToast
      :visible="toast.visible"
      :title="toast.title"
      :message="toast.message"
      :type="toast.type"
      @close="
        toast.visible = false
      "
    />


    <!-- ======================================================
         REGISTER / EDIT MODAL
         ====================================================== -->

    <Modal
      :open="
        openRegister ||
        openEdit
      "
      :title="
        editing
          ? 'Edit patient'
          : 'Register new patient'
      "
      :description="
        editing
          ? 'Update the existing permanent patient EHR.'
          : 'Create the permanent patient record. Later clinical records remain linked to this patient.'
      "
      @close="closeModal"
    >
      <form
        class="space-y-5"
        @submit.prevent="savePatient"
      >
        <!-- ==================================================
             BASIC INFORMATION
             ================================================== -->

        <div
          class="grid gap-4 sm:grid-cols-2"
        >
          <FormField
            label="First name"
            required
          >
            <BaseInput
              v-model="form.firstName"
              required
            />
          </FormField>


          <FormField
            label="Last name"
            required
          >
            <BaseInput
              v-model="form.lastName"
              required
            />
          </FormField>


          <FormField label="NIC">
            <BaseInput
              v-model="form.nic"
            />
          </FormField>


          <FormField
            label="Date of birth"
            required
          >
            <BaseInput
              v-model="form.dateOfBirth"
              type="date"
              :max="
                todayDateInputValue()
              "
              required
            />
          </FormField>


          <FormField label="Age">
            <BaseInput
              :model-value="
                currentAge == null
                  ? ''
                  : String(currentAge)
              "
              readonly
              :placeholder="
                form.dateOfBirth
                  ? 'Calculated automatically'
                  : 'Enter date of birth'
              "
            />
          </FormField>


          <FormField
            label="Gender"
            required
          >
            <BaseSelect
              v-model="form.gender"
              required
            >
              <option value="">
                Select gender
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


          <FormField label="Blood group">
            <BaseSelect
              v-model="form.bloodGroup"
            >
              <option value="">
                Select blood group
              </option>

              <option
                v-for="group in bloodGroups"
                :key="group"
                :value="group"
              >
                {{ group }}
              </option>
            </BaseSelect>
          </FormField>


          <FormField label="Height (cm)">
            <BaseInput
              v-model.number="
                form.heightCm
              "
              type="number"
              min="1"
              max="300"
            />
          </FormField>


          <FormField label="Weight (kg)">
            <BaseInput
              v-model.number="
                form.weightKg
              "
              type="number"
              min="1"
              max="500"
            />
          </FormField>
        </div>


        <!-- ==================================================
             CONTACT / LOCATION
             ================================================== -->

        <div
          class="grid gap-4 sm:grid-cols-2"
        >
          <FormField label="Phone">
            <BaseInput
              v-model="form.phone"
            />
          </FormField>


          <FormField label="Email">
            <BaseInput
              v-model="form.email"
              type="email"
            />
          </FormField>


          <FormField
            label="Province"
            required
          >
            <BaseSelect
              v-model="form.province"
              required
              @change="
                handleProvinceChange
              "
            >
              <option value="">
                Select province
              </option>

              <option
                v-for="
                  province in SRI_LANKAN_PROVINCES
                "
                :key="province"
                :value="province"
              >
                {{ province }}
              </option>
            </BaseSelect>
          </FormField>


          <FormField
            label="District"
            required
          >
            <BaseSelect
              v-model="form.district"
              :disabled="!form.province"
              required
            >
              <option value="">
                Select district
              </option>

              <option
                v-for="
                  district in availableDistricts
                "
                :key="district"
                :value="district"
              >
                {{ district }}
              </option>
            </BaseSelect>
          </FormField>


          <FormField label="Workplace">
            <BaseInput
              v-model="form.workplace"
            />
          </FormField>


          <div class="sm:col-span-2">
            <FormField label="Address">
              <BaseTextarea
                v-model="form.address"
              />
            </FormField>
          </div>
        </div>


        <!-- ==================================================
             ALLERGY INFORMATION
             ================================================== -->

        <div
          class="rounded-2xl border border-amber-200 bg-amber-50 p-5"
        >
          <div
            class="flex items-start justify-between gap-3"
          >
            <div>
              <h3
                class="font-bold text-amber-900"
              >
                Allergy information
              </h3>

              <p
                class="mt-1 text-xs text-amber-800"
              >
                Allergy assessment is required
                for a complete patient record.
              </p>
            </div>

            <span
              class="text-xs font-black uppercase tracking-wide text-amber-700"
            >
              Required
            </span>
          </div>


          <div class="mt-4">
            <FormField
              label="Allergy status"
              required
            >
              <BaseSelect
                v-model="
                  form.allergyStatus
                "
                required
                @change="
                  handleAllergyStatusChange
                "
              >
                <option value="">
                  Select allergy status
                </option>

                <option
                  value="NO_KNOWN_ALLERGIES"
                >
                  No known allergies
                </option>

                <option
                  value="HAS_ALLERGIES"
                >
                  Has allergies
                </option>

                <option value="UNKNOWN">
                  Unknown / unable to determine
                </option>
              </BaseSelect>
            </FormField>
          </div>


          <div
            v-if="
              form.allergyStatus ===
              'HAS_ALLERGIES'
            "
            class="mt-4 rounded-xl border border-amber-200 bg-white p-3 text-xs text-amber-800"
          >
            Add at least one food allergy
            or medical / drug allergy.
          </div>


          <div
            v-if="
              form.allergyStatus ===
              'HAS_ALLERGIES'
            "
            class="mt-4 grid gap-5 sm:grid-cols-2"
          >
            <TagInput
              v-model="
                form.foodAllergies
              "
              label="Food allergies"
              placeholder="e.g. peanuts, seafood, milk"
            />


            <TagInput
              v-model="
                form.medicalAllergies
              "
              label="Medical / drug allergies"
              placeholder="e.g. penicillin, aspirin"
            />
          </div>
        </div>


        <!-- ==================================================
             NOTES
             ================================================== -->

        <FormField
          label="Registration notes"
        >
          <BaseTextarea
            v-model="
              form.registrationNotes
            "
            placeholder="Add relevant registration notes..."
          />
        </FormField>


        <!-- ERROR -->
        <div
          v-if="error"
          class="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {{ error }}
        </div>


        <!-- ACTIONS -->
        <div
          class="flex justify-end gap-2 border-t pt-4"
        >
          <BaseButton
            type="button"
            variant="secondary"
            :disabled="saving"
            @click="closeModal"
          >
            Cancel
          </BaseButton>


          <BaseButton
            type="submit"
            :disabled="saving"
          >
            {{
              saving
                ? "Saving..."
                : editing
                  ? "Save changes"
                  : "Register patient"
            }}
          </BaseButton>
        </div>
      </form>
    </Modal>

    <Modal
      :open="openCentral"
      title="Find existing patient"
      description="Search the central patient registry before creating a new record."
      @close="closeCentral"
    >
      <form class="flex gap-2" @submit.prevent="searchCentral">
        <BaseInput v-model="centralQuery" placeholder="Name, patient number, NIC or phone" required />
        <BaseButton type="submit" :disabled="centralLoading">Search</BaseButton>
      </form>
      <p v-if="centralError" class="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{{ centralError }}</p>
      <p v-else-if="centralSearched && !centralResults.length" class="muted mt-4">No matching patient was found.</p>
      <div v-else class="mt-4 max-h-80 space-y-2 overflow-y-auto">
        <div v-for="candidate in centralResults" :key="candidate.patient_id" class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
          <div>
            <p class="font-bold">{{ candidate.first_name }} {{ candidate.last_name }}</p>
            <p class="text-xs text-slate-500">{{ candidate.patient_number }} · {{ formatDate(candidate.date_of_birth) }}</p>
          </div>
          <BaseButton variant="secondary" size="sm" :disabled="centralSaving" @click="registerExisting(candidate)">
            Register here
          </BaseButton>
        </div>
      </div>
    </Modal>
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
} from "vue-router";

import {
  UserPlus,
} from "lucide-vue-next";

import PageHeader
  from "../components/PageHeader.vue";

import Modal
  from "../components/Modal.vue";

import TagInput
  from "../components/TagInput.vue";

import AppToast
  from "../components/ui/AppToast.vue";

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

import {
  useEHR,
} from "../stores/ehr";

import { apiGet, apiPost } from "../services/api";

import {
  calculateAge,
  formatDate,
  formatLocation,
  toDateInputValue,
  todayDateInputValue,
} from "../utils/patient";

import {
  SRI_LANKA_LOCATIONS,
  SRI_LANKAN_PROVINCES,
} from "../utils/sriLankaLocations";


const {
  patients,
  loading,
  addPatient,
  updatePatient,
  refresh,
} = useEHR();

type CentralPatient = {
  patient_id: number;
  patient_number: string;
  first_name: string;
  last_name: string | null;
  date_of_birth: string | null;
};

const openCentral = ref(false);
const centralQuery = ref("");
const centralResults = ref<CentralPatient[]>([]);
const centralLoading = ref(false);
const centralSaving = ref(false);
const centralSearched = ref(false);
const centralError = ref("");

function closeCentral() {
  if (centralSaving.value) return;
  openCentral.value = false;
  centralResults.value = [];
  centralError.value = "";
  centralSearched.value = false;
}

async function searchCentral() {
  const query = centralQuery.value.trim();
  if (!query) return;
  centralLoading.value = true;
  centralError.value = "";
  centralResults.value = [];
  try {
    const response = await apiGet<{ data?: CentralPatient[] }>(
      `/patients/central-search?q=${encodeURIComponent(query)}`,
    );
    centralResults.value = response.data || [];
    centralSearched.value = true;
  } catch (cause) {
    centralError.value = cause instanceof Error ? cause.message : "Patient search failed.";
  } finally {
    centralLoading.value = false;
  }
}

async function registerExisting(candidate: CentralPatient) {
  centralSaving.value = true;
  centralError.value = "";
  try {
    await apiPost(`/patients/${candidate.patient_id}/register-at-current-hospital`, {});
    await refresh();
    openCentral.value = false;
    centralResults.value = [];
    centralSearched.value = false;
    toast.title = "Patient registered";
    toast.message = `${candidate.first_name} ${candidate.last_name || ""} is available at this hospital.`.trim();
    toast.type = "success";
    toast.visible = true;
  } catch (cause) {
    centralError.value = cause instanceof Error ? cause.message : "Unable to register patient.";
  } finally {
    centralSaving.value = false;
  }
}


const search =
  ref("");

const genderFilter =
  ref("");

const openRegister =
  ref(false);

const openEdit =
  ref(false);

const editing =
  ref(false);

const editingId =
  ref("");

const saving =
  ref(false);

const error =
  ref("");


/*
 * ============================================================
 * TOAST STATE
 * ============================================================
 */

const toast = reactive({
  visible: false,

  title: "",

  message: "",

  type:
    "success" as
      | "success"
      | "error",
});


/*
 * ============================================================
 * CONSTANTS
 * ============================================================
 */

const bloodGroups = [
  "O+",
  "O-",
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
];


/*
 * ============================================================
 * FORM
 * ============================================================
 */

const form =
  reactive<any>({
    firstName: "",

    lastName: "",

    nic: "",

    dateOfBirth: "",

    gender: "",

    bloodGroup: "",

    heightCm: "",

    weightKg: "",

    phone: "",

    email: "",

    address: "",

    province: "",

    district: "",

    workplace: "",

    allergyStatus: "",

    foodAllergies: [],

    medicalAllergies: [],

    registrationNotes: "",
  });


/*
 * ============================================================
 * LOCATION
 * ============================================================
 */

const availableDistricts =
  computed(() =>
    form.province
      ? SRI_LANKA_LOCATIONS[
          form.province
        ] || []
      : [],
  );


/*
 * ============================================================
 * FILTERED PATIENTS
 * ============================================================
 */

const filtered =
  computed(() => {
    const q =
      search.value
        .trim()
        .toLowerCase();

    return patients.value.filter(
      (patient) => {
        const matchesText =
          !q ||
          [
            patient.firstName,
            patient.lastName,
            patient.patientNumber,
            patient.nic,
            patient.phone,
            patient.address,
            patient.district,
            patient.province,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q);

        const matchesGender =
          !genderFilter.value ||
          patient.gender ===
            genderFilter.value;

        return (
          matchesText &&
          matchesGender
        );
      },
    );
  });


/*
 * ============================================================
 * DERIVED AGE
 * ============================================================
 */

const currentAge =
  computed(() =>
    calculateAge(
      form.dateOfBirth,
    ),
  );


/*
 * ============================================================
 * RESET
 * ============================================================
 */

function resetForm() {
  Object.assign(
    form,
    {
      firstName: "",

      lastName: "",

      nic: "",

      dateOfBirth: "",

      gender: "",

      bloodGroup: "",

      heightCm: "",

      weightKg: "",

      phone: "",

      email: "",

      address: "",

      province: "",

      district: "",

      workplace: "",

      allergyStatus: "",

      foodAllergies: [],

      medicalAllergies: [],

      registrationNotes: "",
    },
  );
}


/*
 * ============================================================
 * OPEN REGISTER
 * ============================================================
 */

function openRegisterModal() {
  if (saving.value) {
    return;
  }

  resetForm();

  error.value = "";

  editing.value = false;

  editingId.value = "";

  openEdit.value = false;

  openRegister.value = true;
}


/*
 * ============================================================
 * CLOSE
 * ============================================================
 */

function closeModal() {
  if (saving.value) {
    return;
  }

  openRegister.value = false;

  openEdit.value = false;

  editing.value = false;

  editingId.value = "";

  error.value = "";
}


/*
 * ============================================================
 * EDIT
 * ============================================================
 */

function startEdit(
  patient: any,
) {
  editing.value = true;

  editingId.value =
    patient.id;

  Object.assign(
    form,
    {
      firstName:
        patient.firstName,

      lastName:
        patient.lastName,

      nic:
        patient.nic,

      dateOfBirth:
        toDateInputValue(
          patient.dateOfBirth,
        ),

      gender:
        patient.gender,

      bloodGroup:
        patient.bloodGroup,

      heightCm:
        patient.heightCm || "",

      weightKg:
        patient.weightKg || "",

      phone:
        patient.phone,

      email:
        patient.email,

      address:
        patient.address,

      province:
        patient.province,

      district:
        patient.district,

      workplace:
        patient.workplace,

      allergyStatus:
        patient.allergyStatus ||
        "UNKNOWN",

      foodAllergies: [
        ...(patient.foodAllergies ||
          []),
      ],

      medicalAllergies: [
        ...(patient.medicalAllergies ||
          []),
      ],

      registrationNotes:
        patient.registrationNotes ||
        "",
    },
  );

  error.value = "";

  openRegister.value =
    false;

  openEdit.value =
    true;
}


/*
 * ============================================================
 * PROVINCE
 * ============================================================
 */

function handleProvinceChange() {
  if (
    !availableDistricts.value.includes(
      form.district,
    )
  ) {
    form.district =
      "";
  }
}


/*
 * ============================================================
 * ALLERGY STATUS
 * ============================================================
 */

function handleAllergyStatusChange() {
  if (
    form.allergyStatus !==
    "HAS_ALLERGIES"
  ) {
    form.foodAllergies = [];

    form.medicalAllergies = [];
  }
}


/*
 * ============================================================
 * TOAST
 * ============================================================
 */

function showToast(
  title: string,
  message: string,
  type:
    | "success"
    | "error" = "success",
) {
  toast.visible = false;

  window.setTimeout(() => {
    toast.title = title;

    toast.message = message;

    toast.type = type;

    toast.visible = true;
  }, 0);
}


/*
 * ============================================================
 * SAVE PATIENT
 * ============================================================
 */

async function savePatient() {
  saving.value = true;

  error.value = "";


  try {
    const calculatedAge =
      calculateAge(
        form.dateOfBirth,
      );


    /*
     * --------------------------
     * AGE
     * --------------------------
     */

    if (
      !form.dateOfBirth
    ) {
      throw new Error(
        "Date of birth is required.",
      );
    }


    if (
      calculatedAge ===
        null ||
      calculatedAge <
        18 ||
      calculatedAge >
        120
    ) {
      throw new Error(
        "Only patients aged between 18 and 120 years can be registered.",
      );
    }


    /*
     * --------------------------
     * GENDER
     * --------------------------
     */

    if (!form.gender) {
      throw new Error(
        "Gender is required.",
      );
    }


    /*
     * --------------------------
     * PROVINCE
     * --------------------------
     */

    if (!form.province) {
      throw new Error(
        "Province is required.",
      );
    }


    /*
     * --------------------------
     * DISTRICT
     * --------------------------
     */

    if (!form.district) {
      throw new Error(
        "District is required.",
      );
    }


    if (
      !availableDistricts.value.includes(
        form.district,
      )
    ) {
      throw new Error(
        "Select a valid district for the selected province.",
      );
    }


    /*
     * --------------------------
     * ALLERGY
     * --------------------------
     */

    if (
      !form.allergyStatus
    ) {
      throw new Error(
        "Allergy status is required.",
      );
    }


    if (
      form.allergyStatus ===
        "HAS_ALLERGIES" &&
      !form.foodAllergies
        .length &&
      !form.medicalAllergies
        .length
    ) {
      throw new Error(
        "At least one food or medical / drug allergy is required.",
      );
    }


    /*
     * --------------------------
     * NORMALIZE NO KNOWN
     * --------------------------
     */

    if (
      form.allergyStatus ===
      "NO_KNOWN_ALLERGIES"
    ) {
      form.foodAllergies =
        [];

      form.medicalAllergies =
        [];
    }


    const wasEditing =
      editing.value;


    /*
     * --------------------------
     * UPDATE
     * --------------------------
     */

    if (
      editing.value
    ) {
      await updatePatient(
        editingId.value,
        {
          ...form,

          allergies: [
            ...form.foodAllergies,
            ...form.medicalAllergies,
          ],
        },
      );
    }

    /*
     * --------------------------
     * CREATE
     * --------------------------
     */

    else {
      await addPatient({
        ...form,

        allergies: [
          ...form.foodAllergies,
          ...form.medicalAllergies,
        ],
      });
    }


    /*
     * --------------------------
     * SUCCESS
     * --------------------------
     */

    closeModal();

    resetForm();

    showToast(
      wasEditing
        ? "Patient updated"
        : "Patient registered",

      wasEditing
        ? "The existing patient EHR was updated successfully."
        : "The permanent patient EHR was created successfully.",

      "success",
    );
  } catch (
    saveError
  ) {
    error.value =
      saveError instanceof
        Error
        ? saveError.message
        : "Unable to save patient.";

    showToast(
      "Unable to save patient",
      error.value,
      "error",
    );
  } finally {
    saving.value =
      false;
  }
}
</script>
