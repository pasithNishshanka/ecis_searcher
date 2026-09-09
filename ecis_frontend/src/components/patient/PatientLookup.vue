<template>
  <div>
    <FormField :label="label || 'Patient'
      ">
      <BaseInput v-model="query" :placeholder="placeholder
        " autocomplete="off" />
    </FormField>


    <div v-if="
      query.trim() &&
      matches.length
    " class="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button v-for="patient in matches" :key="patient.id" type="button"
        class="flex w-full items-center gap-3 border-b border-slate-100 p-3 text-left last:border-0 hover:bg-teal-50"
        @click="
          selectPatient(
            patient,
          )
          ">
        <div class="avatar size-9 text-xs">
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


        <div class="min-w-0">
          <p class="truncate text-sm font-bold">
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
      </button>
    </div>


    <div v-else-if="
      query.trim()
    " class="mt-2 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-400">
      No registered patient found.
    </div>


    <div v-if="selected"
      class="mt-3 flex items-center justify-between rounded-xl border border-teal-100 bg-teal-50 p-3">
      <div>
        <p class="text-sm font-bold text-teal-950">
          {{
            selected.firstName
          }}
          {{
            selected.lastName
          }}
        </p>

        <p class="text-xs text-teal-700">
          {{
            selected.patientNumber
          }}
        </p>
      </div>


      <BaseButton type="button" variant="ghost" size="sm" @click="clear">
        Change
      </BaseButton>
    </div>
  </div>
</template>


<script setup lang="ts">
import {
  computed,
  ref,
} from "vue";


import BaseInput
  from "../ui/BaseInput.vue";


import BaseButton
  from "../ui/BaseButton.vue";


import FormField
  from "../forms/FormField.vue";


const props =
  withDefaults(
    defineProps<{
      patients: any[];

      modelValue?: any;

      label?: string;

      placeholder?: string;
    }>(),

    {
      placeholder:
        "Search name / ID / NIC",

      label:
        "Registered patient",
    },
  );


const emit =
  defineEmits<{
    "update:modelValue":
    [
      value: any,
    ];
  }>();


const query =
  ref("");


const selected =
  computed(
    () =>
      props.modelValue ||
      null,
  );


const matches =
  computed(() => {
    const q =
      query.value
        .trim()
        .toLowerCase();


    if (!q) {
      return [];
    }


    return props.patients
      .filter(
        (
          patient,
        ) =>
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
            .includes(q),
      )
      .slice(
        0,
        10,
      );
  });


function selectPatient(
  patient: any,
) {
  emit(
    "update:modelValue",
    patient,
  );

  query.value =
    "";
}


function clear() {
  emit(
    "update:modelValue",
    null,
  );
}
</script>