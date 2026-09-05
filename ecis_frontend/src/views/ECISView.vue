<template>
<div>
  <PageHeader eyebrow="Emergency Clinical Identity Search" title="ECIS Search" description="Search existing hospital EHR information and rank possible patient candidates for authorized staff review.">
    <StatusBadge tone="info" label="Existing EHR only" />
  </PageHeader>

  <div class="grid gap-6 xl:grid-cols-[320px_1fr]">
    <aside class="card p-5">
      <div class="flex items-center justify-between"><h2 class="section-title text-base">Search filters</h2><BaseButton variant="ghost" size="sm" @click="clear">Clear all</BaseButton></div>
      <div class="mt-5 space-y-4">
        <RangeField label="Age" v-model:min-value="f.ageMin" v-model:max-value="f.ageMax" :min="0" :max="120" hint="Years" />
        <RangeField label="Height" v-model:min-value="f.heightMin" v-model:max-value="f.heightMax" :min="30" :max="250" :step="0.1" hint="cm" />
        <RangeField label="Weight" v-model:min-value="f.weightMin" v-model:max-value="f.weightMax" :min="1" :max="400" :step="0.1" hint="kg" />
        <FormField label="Blood group"><BaseSelect v-model="f.bloodGroup"><option value="">Any</option><option v-for="x in groups" :key="x">{{x}}</option></BaseSelect></FormField>
        <FormField label="Province"><BaseSelect v-model="f.province"><option value="">Any</option><option v-for="x in provinces" :key="x">{{x}}</option></BaseSelect></FormField>
        <FormField label="District"><BaseInput v-model="f.district" placeholder="Colombo" /></FormField>
        <FormField label="Gender / observed sex"><BaseSelect v-model="f.gender"><option value="">Any</option><option>Male</option><option>Female</option><option>Other</option></BaseSelect></FormField>
        <FormField label="Partial name / initials"><BaseInput v-model="f.name" placeholder="K / Pasi / Kasun" /></FormField>
        <FormField label="Phone digits"><BaseInput v-model="f.phoneDigits" placeholder="Ends in 4567" /></FormField>
        <FormField label="Workplace"><BaseInput v-model="f.workplace" placeholder="Phoenix" /></FormField>
        <FormField label="Previous procedure"><BaseInput v-model="f.procedure" placeholder="fracture fixation" /></FormField>
        <FormField label="Implant / device"><BaseInput v-model="f.implant" placeholder="orthopedic plate" /></FormField>
        <FormField label="Clinical finding"><BaseInput v-model="f.finding" placeholder="surgical scar" /></FormField>
        <FormField label="Body region"><BaseInput v-model="f.bodyRegion" placeholder="right arm" /></FormField>
        <FormField label="Missing body part"><BaseInput v-model="f.missingBodyPart" placeholder="left finger" /></FormField>
        <FormField label="Scar description"><BaseInput v-model="f.scar" placeholder="right arm scar" /></FormField>
        <FormField label="Birthmark"><BaseInput v-model="f.birthmark" /></FormField>
        <FormField label="Tattoo"><BaseInput v-model="f.tattoo" /></FormField>
        <FormField label="Old fracture"><BaseInput v-model="f.fracture" placeholder="humerus fracture" /></FormField>
        <label class="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><input v-model="f.hasSurgery" type="checkbox" class="size-4 accent-teal-700"><span class="text-sm font-bold">Previous surgery</span></label>
        <BaseButton block @click="run"><template #icon><Search :size="16" /></template>Apply filters</BaseButton>
      </div>
    </aside>

    <main>
      <div class="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><b>{{results.length}}</b> candidate{{results.length===1?'':'s'}} found<p class="text-xs text-slate-400">Candidate score supports staff review; it does not automatically confirm identity.</p></div><BaseSelect v-model="sort" class="w-40"><option value="score">Best match</option><option value="name">Name</option></BaseSelect></div>
      <div v-if="!results.length" class="card p-12 text-center"><p class="text-lg font-bold">No candidates found</p><p class="mt-1 text-sm text-slate-400">Try widening the Min / Max ranges or removing a filter.</p></div>
      <div class="space-y-3">
        <article v-for="r in sorted" :key="r.patient.id" class="card p-5">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div class="flex gap-3"><div class="avatar">{{r.patient.firstName[0]}}{{r.patient.lastName[0]}}</div><div><h3 class="font-bold">{{r.patient.firstName}} {{r.patient.lastName}} <StatusBadge :label="r.patient.patientNumber" /></h3><p class="mt-1 text-xs text-slate-400">Age {{age(r.patient.dateOfBirth)}} · {{r.patient.gender}} · {{r.patient.bloodGroup}} · {{r.patient.heightCm}} cm · {{r.patient.weightKg}} kg · {{r.patient.district}}</p><div class="mt-3 flex flex-wrap gap-1.5"><StatusBadge v-for="e in r.evidence" :key="e" tone="info">✓ {{e}}</StatusBadge></div></div></div><div class="flex items-center gap-4"><div class="text-right"><p class="text-3xl font-black text-teal-700">{{Math.min(r.score,99)}}%</p><p class="text-[10px] font-bold uppercase text-slate-400">match score</p></div><RouterLink :to="`/patients/${r.patient.id}`"><BaseButton variant="secondary">Review EHR <ArrowRight :size="15" /></BaseButton></RouterLink></div></div>
        </article>
      </div>
      <div class="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><b>Clinical safety:</b> ECIS is a candidate-search and decision-support workflow. Authorized staff must verify identity before confirming or merging a record.</div>
    </main>
  </div>
</div>
</template>
<script setup lang="ts">
import {computed,reactive,ref} from 'vue';import {RouterLink} from 'vue-router';import {ArrowRight,Search} from 'lucide-vue-next';import PageHeader from '../components/PageHeader.vue';import BaseButton from '../components/ui/BaseButton.vue';import BaseInput from '../components/ui/BaseInput.vue';import BaseSelect from '../components/ui/BaseSelect.vue';import StatusBadge from '../components/ui/StatusBadge.vue';import FormField from '../components/forms/FormField.vue';import RangeField from '../components/forms/RangeField.vue';import {useEHR} from '../stores/ehr'
const {searchECIS}=useEHR();const groups=['O+','O-','A+','A-','B+','B-','AB+','AB-'];const provinces=['Western Province','Central Province','Southern Province','Northern Province'];const f=reactive<any>({ageMin:undefined,ageMax:undefined,heightMin:undefined,heightMax:undefined,weightMin:undefined,weightMax:undefined,bloodGroup:'',province:'',district:'',gender:'',name:'',phoneDigits:'',workplace:'',procedure:'',implant:'',finding:'',bodyRegion:'',missingBodyPart:'',scar:'',birthmark:'',tattoo:'',fracture:'',hasSurgery:false});const results=ref<any[]>(searchECIS(f));const sort=ref('score');const sorted=computed(()=>[...results.value].sort((a,b)=>sort.value==='name'?`${a.patient.firstName}${a.patient.lastName}`.localeCompare(`${b.patient.firstName}${b.patient.lastName}`):b.score-a.score));function run(){results.value=searchECIS({...f})}function clear(){Object.assign(f,{ageMin:undefined,ageMax:undefined,heightMin:undefined,heightMax:undefined,weightMin:undefined,weightMax:undefined,bloodGroup:'',province:'',district:'',gender:'',name:'',phoneDigits:'',workplace:'',procedure:'',implant:'',finding:'',bodyRegion:'',missingBodyPart:'',scar:'',birthmark:'',tattoo:'',fracture:'',hasSurgery:false});run()}function age(d:string){return Math.floor((Date.now()-new Date(d).getTime())/31557600000)}
</script>
