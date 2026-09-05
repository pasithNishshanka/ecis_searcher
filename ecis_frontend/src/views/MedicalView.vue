
<template>
<div>
<PageHeader eyebrow="Clinical intelligence" title="Medical Records & AI Summary"
 description="Review the patient's accumulated EHR and generate a concise clinical summary. This frontend currently uses a deterministic demo generator; a real AI service can be connected later.">
<BaseButton :disabled="!selected || generating" :loading="generating" @click="generate">
<span>✦</span>{{generating?'Generating...':'Generate AI Summary'}}
</BaseButton>
</PageHeader>

<div class="grid gap-5 lg:grid-cols-[300px_1fr]">
<aside class="card p-4">
<div class="mb-4"><h2 class="section-title text-base">Select patient</h2><p class="muted mt-1">Choose an existing EHR record.</p></div>
<BaseInput v-model="q" placeholder="Search name / patient ID" />
<div class="mt-3 max-h-[620px] space-y-2 overflow-y-auto">
<button v-for="p in filtered" :key="p.id" @click="select(p)"
 class="w-full rounded-xl border p-3 text-left hover:bg-teal-50"
 :class="selected?.id===p.id?'border-teal-300 bg-teal-50':'border-slate-100'">
<div class="flex gap-3"><div class="avatar">{{p.firstName[0]}}{{p.lastName[0]}}</div><div><b class="text-sm">{{p.firstName}} {{p.lastName}}</b><p class="text-xs text-slate-400">{{p.patientNumber}}</p></div></div>
</button>
</div>
</aside>

<main v-if="selected" class="space-y-5">
<section class="card p-5">
<div class="flex flex-col justify-between gap-4 sm:flex-row">
<div class="flex gap-3"><div class="avatar">{{selected.firstName[0]}}{{selected.lastName[0]}}</div><div><h2 class="section-title">{{selected.firstName}} {{selected.lastName}}</h2><p class="muted">{{selected.patientNumber}} · {{selected.bloodGroup}} · {{selected.district}}</p></div></div>
<RouterLink :to="`/patients/${selected.id}`"><BaseButton variant="secondary">Open full EHR <ArrowRight :size="15" /></BaseButton></RouterLink>
</div>

<div class="mt-5 grid gap-3 sm:grid-cols-4">
<div class="rounded-xl bg-slate-50 p-3"><p class="label">Age</p><b>{{age}} years</b></div>
<div class="rounded-xl bg-slate-50 p-3"><p class="label">Blood</p><b>{{selected.bloodGroup}}</b></div>
<div class="rounded-xl bg-slate-50 p-3"><p class="label">Height</p><b>{{selected.heightCm}} cm</b></div>
<div class="rounded-xl bg-slate-50 p-3"><p class="label">Records</p><b>{{records.length}}</b></div>
</div>
</section>

<section class="card overflow-hidden">
<div class="flex flex-col justify-between gap-3 border-b bg-teal-50/50 p-5 sm:flex-row sm:items-center">
<div><div class="flex items-center gap-2"><span class="grid size-9 place-items-center rounded-xl bg-teal-700 text-white">✦</span><h2 class="section-title">AI Clinical Summary</h2></div><p class="mt-1 text-xs text-slate-500">Generated from the selected patient's existing clinical records.</p></div>
<BaseButton v-if="summary" variant="secondary" @click="generate">Regenerate</BaseButton>
</div>

<div v-if="summary" class="p-5">
<div class="rounded-xl border border-teal-100 bg-white p-5 text-sm leading-7 text-slate-700 shadow-sm">
<div class="mb-3 flex items-center gap-2"><span class="badge bg-teal-100 text-teal-800">AI SUMMARY</span><span class="text-xs text-slate-400">Demo generation</span></div>
<p>{{summary}}</p>
</div>
<div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
<b>Important:</b> This summary is decision-support only. Clinical staff must review the source EHR records before making clinical decisions.
</div>
</div>

<div v-else class="p-10 text-center">
<div class="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-50 text-2xl text-teal-700">✦</div>
<h3 class="mt-4 font-bold">AI summary is ready</h3>
<p class="mx-auto mt-1 max-w-md text-sm text-slate-400">Click <b>Generate AI Summary</b> to summarize this patient's existing OPD, ward, surgery and procedure history.</p>
<BaseButton class="mt-5" @click="generate">Generate AI Summary</BaseButton>
</div>
</section>

<section class="card overflow-hidden">
<div class="border-b p-5"><h2 class="section-title">Source clinical history</h2><p class="muted mt-1">The summary is based on these linked EHR records.</p></div>
<div class="divide-y divide-slate-100">
<div v-for="t in records" :key="t.id" class="p-5">
<div class="flex justify-between gap-3"><div><span class="badge">{{t.type}}</span><h3 class="mt-2 font-bold">{{t.treatment}}</h3><p class="text-sm text-slate-500">{{t.department}} · {{t.diagnosis}}</p></div><span class="text-xs text-slate-400">{{t.date}}</span></div>
<div class="mt-3 flex flex-wrap gap-2">
<span v-if="t.bodyRegion" class="badge">Body: {{t.bodyRegion}}</span>
<span v-if="t.implant" class="badge">Implant: {{t.implant}}</span>
<span v-if="t.scar" class="badge">Scar: {{t.scar}}</span>
<span v-if="t.oldFracture" class="badge">Fracture: {{t.oldFracture}}</span>
</div>
<p v-if="t.notes" class="mt-3 text-sm leading-6 text-slate-500">{{t.notes}}</p>
</div>
<div v-if="!records.length" class="p-10 text-center text-sm text-slate-400">No clinical records available.</div>
</div>
</section>
</main>

<section v-else class="card grid place-items-center p-16 text-center">
<div><div class="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-50 text-2xl text-teal-700">✦</div><h2 class="mt-4 font-bold">Select a patient</h2><p class="mt-1 text-sm text-slate-400">The patient's existing EHR history will be used for the summary.</p></div>
</section>
</div>
</div>
</template>

<script setup lang="ts">
import {computed,ref} from 'vue'
import {RouterLink} from 'vue-router'
import {ArrowRight} from 'lucide-vue-next';import BaseButton from '../components/ui/BaseButton.vue';import BaseInput from '../components/ui/BaseInput.vue';import PageHeader from '../components/PageHeader.vue'
import {useEHR} from '../stores/ehr'

const {patients,treatmentsForPatient}=useEHR()
const q=ref(''),selected=ref<any>(null),summary=ref(''),generating=ref(false)
const filtered=computed(()=>patients.value.filter(p=>`${p.firstName} ${p.lastName} ${p.patientNumber}`.toLowerCase().includes(q.value.toLowerCase())))
const records=computed(()=>selected.value?treatmentsForPatient(selected.value.id):[])
const age=computed(()=>selected.value?Math.floor((Date.now()-new Date(selected.value.dateOfBirth).getTime())/31557600000):0)

function select(p:any){selected.value=p;summary.value=''}
function generate(){
 if(!selected.value)return
 generating.value=true
 setTimeout(()=>{
  const r=records.value
  const surgeries=r.filter((x:any)=>x.type==='SURGERY').length
  const procedures=r.filter((x:any)=>x.type==='PROCEDURE').length
  const ward=r.filter((x:any)=>x.type==='WARD').length
  const allergies=selected.value.allergies?.length?selected.value.allergies.join(', '):'none recorded'
  const chronic=selected.value.chronicDiseases?.length?selected.value.chronicDiseases.join(', '):'none recorded'
  const findings=r.flatMap((x:any)=>[x.scar,x.birthmark,x.tattoo,x.implant,x.oldFracture,x.missingBodyPart].filter(Boolean))
  summary.value=`${selected.value.firstName} ${selected.value.lastName} is a ${selected.value.gender.toLowerCase()} patient aged ${age.value} years with blood group ${selected.value.bloodGroup}. The record contains ${r.length} linked clinical record(s), including ${surgeries} surgery record(s), ${procedures} procedure record(s), and ${ward} ward admission record(s). Recorded allergies: ${allergies}. Chronic diseases: ${chronic}. ${findings.length?`Documented clinical findings include ${findings.join(', ')}.`:'No additional scar, birthmark, tattoo, implant, fracture or missing-body-part finding is currently recorded.'} The most recent documented treatment is ${r[0]?.treatment||'not available'}.`
  generating.value=false
 },450)
}
</script>
