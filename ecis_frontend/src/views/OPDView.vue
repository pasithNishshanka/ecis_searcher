<template>
<div>
<PageHeader eyebrow="Outpatient Department" title="OPD" description="Select a registered patient, review old history, then create a new visit linked to the same EHR.">
<BaseButton :disabled="!selected" @click="open=true"><template #icon><Plus :size="16" /></template>New OPD visit</BaseButton>
</PageHeader>
<div class="grid gap-6 xl:grid-cols-[340px_1fr]">
<section class="card p-5">
<h2 class="section-title text-base">Registered patients</h2><p class="muted mt-1">Select a patient to review previous visits.</p>
<PatientLookup v-model="selected" :patients="patients" class="mt-4" label="" placeholder="Search name / ID / NIC" />
<div v-if="!selected" class="mt-6 rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-400">Search and select a registered patient to continue.</div>
</section>
<section v-if="selected" class="space-y-5">
<div class="card p-5"><div class="flex flex-wrap justify-between gap-4"><div><h2 class="section-title">{{selected.firstName}} {{selected.lastName}}</h2><p class="muted">{{selected.patientNumber}} · {{selected.nic||'NIC not recorded'}}</p></div><RouterLink :to="`/patients/${selected.id}`"><BaseButton variant="secondary">Open full EHR <ArrowRight :size="15" /></BaseButton></RouterLink></div>
<div class="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"><InfoBox label="DOB" :value="selected.dateOfBirth"/><InfoBox label="Age" :value="`${age} years`"/><InfoBox label="Blood" :value="selected.bloodGroup"/><InfoBox label="Height" :value="`${selected.heightCm} cm`"/></div></div>
<div class="card overflow-hidden"><div class="border-b p-5"><h2 class="section-title">Previous OPD & treatment history</h2><p class="muted mt-1">Old records are shown before starting the new consultation.</p></div>
<div class="divide-y divide-slate-100"><article v-for="t in history" :key="t.id" class="p-5"><div class="flex justify-between gap-3"><div><StatusBadge :label="t.type" tone="info"/><h3 class="mt-2 font-bold">{{t.treatment}}</h3><p class="text-sm text-slate-500">{{t.diagnosis}}</p></div><span class="text-xs text-slate-400">{{t.date}}</span></div><p class="mt-2 text-sm text-slate-600">{{t.department}} · {{t.doctor}}</p><p v-if="t.notes" class="mt-2 text-sm text-slate-500">{{t.notes}}</p></article><div v-if="!history.length" class="p-10 text-center text-sm text-slate-400">No previous history recorded.</div></div></div>
</section>
<section v-else class="card grid place-items-center p-16 text-center"><div><div class="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-50 text-teal-700"><UserRound :size="26"/></div><h2 class="mt-4 font-bold">Select a registered patient</h2><p class="mt-1 text-sm text-slate-400">Previous history will appear here.</p></div></section>
</div>
<Modal :open="open" title="New OPD visit" description="Saved to the selected patient's existing EHR." @close="open=false">
<form v-if="selected" @submit.prevent="save" class="grid gap-4 sm:grid-cols-2">
<div class="sm:col-span-2 rounded-xl bg-teal-50 p-4 font-bold text-teal-900">{{selected.firstName}} {{selected.lastName}} · {{selected.patientNumber}}</div>
<FormField label="Department"><BaseSelect v-model="f.department"><option>Medicine</option><option>Cardiology</option><option>Orthopedics</option><option>General Surgery</option><option>Pediatrics</option><option>ENT</option><option>Dermatology</option></BaseSelect></FormField>
<FormField label="Doctor" required><BaseInput v-model="f.doctor" required /></FormField>
<div class="sm:col-span-2"><FormField label="Diagnosis" required><BaseInput v-model="f.diagnosis" required /></FormField></div>
<div class="sm:col-span-2"><FormField label="Treatment / plan"><BaseTextarea v-model="f.treatment" /></FormField></div>
<div class="sm:col-span-2"><FormField label="Clinical notes"><BaseTextarea v-model="f.notes" /></FormField></div>
<div class="sm:col-span-2 flex justify-end gap-2 border-t pt-4"><BaseButton variant="secondary" type="button" @click="open=false">Cancel</BaseButton><BaseButton type="submit">Save OPD visit</BaseButton></div>
</form></Modal>
</div>
</template>
<script setup lang="ts">
import {computed,reactive,ref} from 'vue';import {RouterLink} from 'vue-router';import {ArrowRight,Plus,UserRound} from 'lucide-vue-next';import PageHeader from '../components/PageHeader.vue';import Modal from '../components/Modal.vue';import BaseButton from '../components/ui/BaseButton.vue';import BaseInput from '../components/ui/BaseInput.vue';import BaseSelect from '../components/ui/BaseSelect.vue';import BaseTextarea from '../components/ui/BaseTextarea.vue';import FormField from '../components/forms/FormField.vue';import StatusBadge from '../components/ui/StatusBadge.vue';import PatientLookup from '../components/patient/PatientLookup.vue';import {useEHR} from '../stores/ehr'
const InfoBox={props:['label','value'],template:`<div class="rounded-xl bg-slate-50 p-3"><p class="label">{{label}}</p><p class="mt-1 text-sm font-bold">{{value}}</p></div>`}
const {patients,treatmentsForPatient,addTreatment}=useEHR();const selected=ref<any>(null),open=ref(false);const f=reactive({department:'Medicine',doctor:'',diagnosis:'',treatment:'',notes:''});const history=computed(()=>selected.value?treatmentsForPatient(selected.value.id):[]);const age=computed(()=>selected.value?Math.floor((Date.now()-new Date(selected.value.dateOfBirth).getTime())/31557600000):0);function save(){addTreatment({patientId:selected.value.id,type:'OPD',date:new Date().toISOString().slice(0,10),...f});open.value=false;Object.assign(f,{department:'Medicine',doctor:'',diagnosis:'',treatment:'',notes:''});alert('OPD visit saved to patient EHR.')}
</script>
