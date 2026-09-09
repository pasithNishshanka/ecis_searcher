<template>
  <div>
    <PageHeader eyebrow="Patient registry" title="Patients"
      description="Register each patient once and maintain the same permanent EHR throughout their care.">
      <BaseButton @click="
        openRegister = true
        ">
        <template #icon>
          <UserPlus :size="16" />
        </template>

        Register patient
      </BaseButton>
    </PageHeader>


    <!-- SEARCH -->

    <section class="card p-5">
      <div class="grid gap-3 md:grid-cols-[1fr_180px]">
        <BaseInput v-model="search" placeholder="Search name / Patient ID / NIC / phone" />

        <BaseSelect v-model="genderFilter">
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


    <!-- PATIENT TABLE -->

    <section class="card mt-6 overflow-hidden">
      <div class="border-b p-5">
        <div class="flex items-center justify-between">
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
              <th class="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                Patient
              </th>

              <th class="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                DOB
              </th>

              <th class="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                Blood
              </th>

              <th class="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                Location
              </th>

              <th class="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                Actions
              </th>
            </tr>
          </thead>


          <tbody class="divide-y divide-slate-100">
            <tr v-for="
patient in filtered
              " :key="patient.id
                " class="hover:bg-slate-50">
              <td class="px-5 py-4">
                <div class="flex items-center gap-3">
                  <div class="avatar">
                    {{
                      patient
                        .firstName
                        ?.charAt(
                          0,
                        ) || ""
                    }}{{
                      patient
                        .lastName
                        ?.charAt(
                          0,
                        ) || ""
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

                    <p class="text-xs text-slate-400">
                      {{
                        patient.patientNumber
                      }}

                      <span v-if="
                        patient.nic
                      ">
                        ·
                        {{
                          patient.nic
                        }}
                      </span>
                    </p>
                  </div>
                </div>
              </td>


              <td class="px-5 py-4 text-sm">
                {{
                  patient.dateOfBirth ||
                  "—"
                }}
              </td>


              <td class="px-5 py-4 text-sm font-bold">
                {{
                  patient.bloodGroup ||
                  "—"
                }}
              </td>


              <td class="px-5 py-4 text-sm">
                {{
                  patient.district ||
                  "—"
                }}
              </td>


              <td class="px-5 py-4">
                <div class="flex justify-end gap-2">
                  <RouterLink :to="`/patients/${patient.id}`
                    ">
                    <BaseButton variant="secondary" size="sm">
                      Open EHR
                    </BaseButton>
                  </RouterLink>


                  <BaseButton variant="ghost" size="sm" @click="
                    startEdit(
                      patient,
                    )
                    ">
                    Edit
                  </BaseButton>
                </div>
              </td>
            </tr>


            <tr v-if="
              !filtered.length
            ">
              <td colspan="5" class="p-12 text-center text-sm text-slate-400">
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


    <!-- REGISTER / EDIT MODAL -->

    <Modal :open="openRegister ||
      openEdit
      " :title="editing
          ? 'Edit patient'
          : 'Register new patient'
        " :description="editing
          ? 'Update the existing permanent patient EHR.'
          : 'Create the permanent patient record. Later clinical records remain linked to this patient.'
        " @close="
        closeModal
      ">
      <form class="space-y-5" @submit.prevent="
        savePatient
      ">
        <!-- BASIC -->

        <div class="grid gap-4 sm:grid-cols-2">
          <FormField label="First name" required>
            <BaseInput v-model="form.firstName
              " required />
          </FormField>


          <FormField label="Last name" required>
            <BaseInput v-model="form.lastName
              " required />
          </FormField>


          <FormField label="NIC">
            <BaseInput v-model="form.nic
              " />
          </FormField>


          <FormField label="Date of birth" required>
            <BaseInput v-model="form.dateOfBirth
              " type="date" required />
          </FormField>


          <FormField label="Gender">
            <BaseSelect v-model="form.gender
              ">
              <option>
                Male
              </option>

              <option>
                Female
              </option>

              <option>
                Other
              </option>
            </BaseSelect>
          </FormField>


          <FormField label="Blood group">
            <BaseSelect v-model="form.bloodGroup
              ">
              <option v-for="
group in bloodGroups
                " :key="group
                  " :value="group
                  ">
                {{ group }}
              </option>
            </BaseSelect>
          </FormField>


          <FormField label="Height (cm)">
            <BaseInput v-model.number="form.heightCm
              " type="number" min="1" />
          </FormField>


          <FormField label="Weight (kg)">
            <BaseInput v-model.number="form.weightKg
              " type="number" min="1" />
          </FormField>
        </div>


        <!-- CONTACT -->

        <div class="grid gap-4 sm:grid-cols-2">
          <FormField label="Phone">
            <BaseInput v-model="form.phone
              " />
          </FormField>


          <FormField label="Email">
            <BaseInput v-model="form.email
              " type="email" />
          </FormField>


          <FormField label="Province">
            <BaseInput v-model="form.province
              " />
          </FormField>


          <FormField label="District">
            <BaseInput v-model="form.district
              " />
          </FormField>


          <FormField label="Workplace">
            <BaseInput v-model="form.workplace
              " />
          </FormField>


          <div class="sm:col-span-2">
            <FormField label="Address">
              <BaseTextarea v-model="form.address
                " />
            </FormField>
          </div>
        </div>


        <!-- ALLERGIES -->

        <div class="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 class="font-bold text-amber-900">
            Allergy information
          </h3>


          <div class="mt-4 grid gap-5 sm:grid-cols-2">
            <TagInput v-model="form.foodAllergies
              " label="Food allergies" placeholder="e.g. peanuts, seafood, milk" />


            <TagInput v-model="form.medicalAllergies
              " label="Medical / drug allergies" placeholder="e.g. penicillin, aspirin" />
          </div>
        </div>


        <!-- NOTES -->

        <FormField label="Registration notes">
          <BaseTextarea v-model="form.registrationNotes
            " placeholder="Add relevant registration notes..." />
        </FormField>


        <div v-if="error" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {{ error }}
        </div>


        <div class="flex justify-end gap-2 border-t pt-4">
          <BaseButton type="button" variant="secondary" :disabled="saving
            " @click="
              closeModal
            ">
            Cancel
          </BaseButton>


          <BaseButton type="submit" :disabled="saving
            ">
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


const {
  patients,
  loading,
  addPatient,
  updatePatient,
} =
  useEHR();


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


const bloodGroups =
  [
    "O+",
    "O-",
    "A+",
    "A-",
    "B+",
    "B-",
    "AB+",
    "AB-",
  ];


const form =
  reactive<any>({
    firstName: "",
    lastName: "",

    nic: "",

    dateOfBirth: "",

    gender: "Male",

    bloodGroup:
      "O+",

    heightCm: 170,

    weightKg: 70,

    phone: "",

    email: "",

    address: "",

    province:
      "Western Province",

    district:
      "Colombo",

    workplace: "",

    foodAllergies:
      [],

    medicalAllergies:
      [],

    registrationNotes:
      "",
  });


const filtered =
  computed(() => {
    const q =
      search.value
        .trim()
        .toLowerCase();


    return patients.value
      .filter(
        (
          patient,
        ) => {
          const matchesText =
            !q ||
            [
              patient.firstName,

              patient.lastName,

              patient.patientNumber,

              patient.nic,

              patient.phone,
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


function resetForm() {
  Object.assign(
    form,
    {
      firstName: "",
      lastName: "",

      nic: "",

      dateOfBirth: "",

      gender: "Male",

      bloodGroup:
        "O+",

      heightCm: 170,

      weightKg: 70,

      phone: "",

      email: "",

      address: "",

      province:
        "Western Province",

      district:
        "Colombo",

      workplace: "",

      foodAllergies:
        [],

      medicalAllergies:
        [],

      registrationNotes:
        "",
    },
  );
}


function closeModal() {
  if (saving.value) {
    return;
  }


  openRegister.value =
    false;

  openEdit.value =
    false;

  editing.value =
    false;

  error.value =
    "";
}


function startEdit(
  patient: any,
) {
  editing.value =
    true;

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
        patient.dateOfBirth,

      gender:
        patient.gender,

      bloodGroup:
        patient.bloodGroup,

      heightCm:
        patient.heightCm,

      weightKg:
        patient.weightKg,

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

      foodAllergies:
        [
          ...(patient.foodAllergies ||
            []),
        ],

      medicalAllergies:
        [
          ...(patient.medicalAllergies ||
            []),
        ],

      registrationNotes:
        patient.registrationNotes ||
        "",
    },
  );


  error.value =
    "";

  openEdit.value =
    true;
}


async function savePatient() {
  saving.value =
    true;

  error.value =
    "";


  try {
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
    } else {
      await addPatient({
        ...form,

        allergies: [
          ...form.foodAllergies,
          ...form.medicalAllergies,
        ],
      });
    }


    closeModal();

    resetForm();
  } catch (saveError) {
    error.value =
      saveError instanceof
        Error
        ? saveError.message
        : "Unable to save patient.";
  } finally {
    saving.value =
      false;
  }
}
</script>
