<template>
  <div>
    <FormField :label="label" :hint="hint">
      <BaseInput v-model="query" :placeholder="placeholder" />
    </FormField>
    <div v-if="query && matches.length" class="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      <button v-for="patient in matches" :key="patient.id" type="button" class="w-full rounded-lg p-2.5 text-left transition hover:bg-teal-50" @click="select(patient)">
        <div class="flex items-center gap-2.5"><div class="avatar size-9 text-xs">{{patient.firstName[0]}}{{patient.lastName[0]}}</div><div><p class="text-sm font-bold text-slate-800">{{patient.firstName}} {{patient.lastName}}</p><p class="text-[11px] text-slate-400">{{patient.patientNumber}} · {{patient.nic || 'NIC not recorded'}}</p></div></div>
      </button>
    </div>
    <div v-if="selected" class="mt-2 flex items-center justify-between rounded-xl border border-teal-100 bg-teal-50 p-3">
      <div><p class="text-sm font-bold text-teal-900">{{selected.firstName}} {{selected.lastName}}</p><p class="text-[11px] text-teal-700">{{selected.patientNumber}}</p></div>
      <BaseButton variant="ghost" size="sm" type="button" @click="clear">Change</BaseButton>
    </div>
  </div>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue';import BaseInput from '../ui/BaseInput.vue';import BaseButton from '../ui/BaseButton.vue';import FormField from '../forms/FormField.vue'
const props=withDefaults(defineProps<{patients:any[];modelValue?:any;label?:string;hint?:string;placeholder?:string}>(),{label:'Patient',placeholder:'Search name, ID or NIC'})
const emit=defineEmits<{ 'update:modelValue':[value:any] }>();const query=ref('');const selected=computed(()=>props.modelValue || null)
const matches=computed(()=>props.patients.filter(p=>`${p.firstName} ${p.lastName} ${p.patientNumber} ${p.nic||''}`.toLowerCase().includes(query.value.toLowerCase())).slice(0,8))
function select(p:any){emit('update:modelValue',p);query.value=''}function clear(){emit('update:modelValue',null);query.value=''}watch(()=>props.modelValue,v=>{if(!v)query.value=''})
</script>
