<template>
<div v-if="patient">
<PageHeader eyebrow="Patient EHR" :title="`${patient.firstName} ${patient.lastName}`" :description="`${patient.patientNumber} · Longitudinal clinical record`">
<BaseButton @click="openTreatment=true">Add clinical record</BaseButton>
</PageHeader>
<div class="grid gap-6 xl:grid-cols-[320px_1fr]">
<aside class="space-y-4">
<div class="card p-5"><div class="flex gap-3"><div class="avatar">{{patient.firstName[0]}}{{patient.lastName[0]}}</div><div><b>{{patient.firstName}} {{patient.lastName}}</b><p class="text-xs text-slate-400">{{patient.patientNumber}}</p></div></div><div class="mt-5 grid grid-cols-2 gap-2"><Info l="DOB" :v="patient.dateOfBirth"/><Info l="Age" :v="`${age} years`"/><Info l="Blood" :v="patient.bloodGroup"/><Info l="Height" :v="`${patient.heightCm} cm`"/><Info l="Weight" :v="`${patient.weightKg} kg`"/><Info l="District" :v="patient.district"/></div><div class="mt-3 rounded-xl bg-slate-50 p-3"><p class="label">Address</p><p class="text-sm">{{patient.address}}</p></div></div>
<div class="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p class="font-bold text-amber-900">Allergies</p><p class="mt-1 text-sm text-amber-800">{{patient.allergies.join(', ')||'None recorded'}}</p></div>
<RouterLink to="/medical"><BaseButton variant="secondary" block>Open AI summary</BaseButton></RouterLink>
</aside>
<section class="card overflow-hidden"><div class="border-b p-5"><h2 class="section-title">Treatment history</h2><p class="muted mt-1">OPD, ward, surgery, procedures, imaging and emergency records remain linked to this patient.</p></div>
<div class="divide-y divide-slate-100"><article v-for="t in records" :key="t.id" class="p-5"><div class="flex flex-col justify-between gap-2 sm:flex-row"><div><span class="badge">{{t.type}}</span><h3 class="mt-2 font-bold">{{t.treatment}}</h3><p class="text-sm text-slate-500">{{t.diagnosis}}</p></div><span class="text-xs text-slate-400">{{t.date}}</span></div><div class="mt-3 grid gap-2 sm:grid-cols-2"><p class="text-sm text-slate-600"><b>Department:</b> {{t.department}}</p><p class="text-sm text-slate-600"><b>Doctor:</b> {{t.doctor}}</p><p v-if="t.bodyRegion" class="text-sm text-slate-600"><b>Body region:</b> {{t.bodyRegion}}</p><p v-if="t.clinicalFinding" class="text-sm text-slate-600"><b>Finding:</b> {{t.clinicalFinding}}</p><p v-if="t.implant" class="text-sm text-slate-600"><b>Implant:</b> {{t.implant}} {{t.implantSerial?'· '+t.implantSerial:''}}</p><p v-if="t.scar" class="text-sm text-slate-600"><b>Scar:</b> {{t.scar}}</p><p v-if="t.oldFracture" class="text-sm text-slate-600"><b>Old fracture:</b> {{t.oldFracture}}</p></div><p class="mt-3 text-sm leading-6 text-slate-600">{{t.notes}}</p></article><div v-if="!records.length" class="p-10 text-center text-sm text-slate-400">No treatment records yet.</div></div></section>
</div>
<Modal :open="openTreatment" title="Add clinical record" description="This is how a later surgery, procedure, scar, implant or other finding becomes searchable by ECIS." @close="openTreatment=false">
<form @submit.prevent="save" class="grid gap-4 sm:grid-cols-2">
<FormField label="Record type"><BaseSelect v-model="t.type"><option>OPD</option><option>WARD</option><option>SURGERY</option><option>PROCEDURE</option><option>LAB</option><option>IMAGING</option><option>EMERGENCY</option></BaseSelect></FormField>
<FormField label="Date" required><BaseInput v-model="t.date" type="date" required /></FormField>
<FormField label="Department" required><BaseInput v-model="t.department" required /></FormField><FormField label="Doctor" required><BaseInput v-model="t.doctor" required /></FormField>
<div class="sm:col-span-2"><FormField label="Diagnosis"><BaseInput v-model="t.diagnosis" /></FormField></div><div class="sm:col-span-2"><FormField label="Treatment / procedure" required><BaseInput v-model="t.treatment" required /></FormField></div>
<FormField label="Body region"><BaseSelect v-model="t.bodyRegion"><option value="">Not specified</option><option>Right arm</option><option>Left arm</option><option>Right leg</option><option>Left leg</option><option>Chest</option><option>Abdomen</option><option>Head/face</option></BaseSelect></FormField>
<FormField label="Clinical finding"><BaseInput v-model="t.clinicalFinding" placeholder="Surgical scar, birthmark..." /></FormField>
<FormField label="Implant / device"><BaseInput v-model="t.implant" placeholder="Pacemaker, orthopedic plate" /></FormField><FormField label="Implant serial number"><BaseInput v-model="t.implantSerial" /></FormField>
<FormField label="Surgical scar"><BaseInput v-model="t.scar" placeholder="Right arm surgical scar" /></FormField><FormField label="Old fracture"><BaseInput v-model="t.oldFracture" /></FormField>
<FormField label="Birthmark"><BaseInput v-model="t.birthmark" /></FormField><FormField label="Tattoo"><BaseInput v-model="t.tattoo" /></FormField>
<FormField label="Missing body part"><BaseInput v-model="t.missingBodyPart" placeholder="Left index finger" /></FormField>
<div class="sm:col-span-2"><FormField label="Clinical notes"><BaseTextarea v-model="t.notes" /></FormField></div>
<div class="sm:col-span-2 flex justify-end gap-2 border-t pt-4"><BaseButton variant="secondary" type="button" @click="openTreatment=false">Cancel</BaseButton><BaseButton type="submit">Save clinical record</BaseButton></div>
</form></Modal>
</div>
<div v-else class="card p-12 text-center">Patient not found.</div>
</template>
<script setup lang="ts">
import {computed,reactive,ref} from 'vue';import {RouterLink,useRoute} from 'vue-router';import BaseButton from '../components/ui/BaseButton.vue';import BaseInput from '../components/ui/BaseInput.vue';import BaseSelect from '../components/ui/BaseSelect.vue';import BaseTextarea from '../components/ui/BaseTextarea.vue';import FormField from '../components/forms/FormField.vue';import PageHeader from '../components/PageHeader.vue';import Modal from '../components/Modal.vue';import {useEHR} from '../stores/ehr'
const Info={props:['l','v'],template:`<div class="rounded-xl bg-slate-50 p-3"><p class="label">{{l}}</p><p class="mt-1 text-sm font-bold">{{v}}</p></div>`};const route=useRoute();const {patientById,treatmentsForPatient,addTreatment}=useEHR();const patient=patientById(String(route.params.id));const records=computed(()=>patient?treatmentsForPatient(patient.id):[]);const age=computed(()=>patient?Math.floor((Date.now()-new Date(patient.dateOfBirth).getTime())/31557600000):0);const openTreatment=ref(false);const t=reactive<any>({type:'OPD',date:new Date().toISOString().slice(0,10),department:'Medicine',doctor:'',diagnosis:'',treatment:'',notes:'',bodyRegion:'',clinicalFinding:'',implant:'',implantSerial:'',scar:'',oldFracture:'',birthmark:'',tattoo:'',missingBodyPart:''});function save(){if(!patient)return;addTreatment({...t,patientId:patient.id});openTreatment.value=false;alert('Clinical record saved to this patient EHR.')} 
</script>
