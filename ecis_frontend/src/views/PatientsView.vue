<template>
<div>
  <PageHeader eyebrow="Patient registry" title="Patients" description="Register once, then continue adding OPD, ward, surgery and treatment history to the same patient record.">
    <BaseButton @click="open=true"><template #icon><UserPlus :size="16" /></template>Register patient</BaseButton>
  </PageHeader>

  <SectionCard>
    <div class="flex flex-col gap-3 sm:flex-row">
      <BaseInput v-model="q" placeholder="Search name, patient ID or NIC" />
      <BaseSelect v-model="gender" class="sm:w-44"><option value="">All gender</option><option>Male</option><option>Female</option><option>Other</option></BaseSelect>
    </div>
  </SectionCard>

  <div class="card mt-5 overflow-hidden"><div class="overflow-x-auto"><table class="min-w-full text-left text-sm">
    <thead class="bg-slate-50 text-xs uppercase text-slate-500"><tr><th class="p-4">Patient</th><th class="p-4">DOB / Age</th><th class="p-4">Blood</th><th class="p-4">Height</th><th class="p-4">District</th><th class="p-4"></th></tr></thead>
    <tbody class="divide-y divide-slate-100">
      <tr v-for="p in filtered" :key="p.id" class="hover:bg-slate-50">
        <td class="p-4"><div class="flex gap-3"><div class="avatar">{{p.firstName[0]}}{{p.lastName[0]}}</div><div><b>{{p.firstName}} {{p.lastName}}</b><p class="text-xs text-slate-400">{{p.patientNumber}} · {{p.nic || 'NIC not recorded'}}</p></div></div></td>
        <td class="p-4">{{p.dateOfBirth}}<p class="text-xs text-slate-400">{{age(p.dateOfBirth)}} years</p></td><td class="p-4 font-bold">{{p.bloodGroup}}</td><td class="p-4">{{p.heightCm}} cm</td><td class="p-4">{{p.district}}</td>
        <td class="p-4 text-right"><RouterLink :to="`/patients/${p.id}`"><BaseButton variant="secondary" size="sm">Open EHR</BaseButton></RouterLink></td>
      </tr>
    </tbody>
  </table></div></div>

  <Modal :open="open" title="Register new patient" description="Create the permanent patient record first. Clinical history is added later through OPD, clinic, ward and treatment workflows." @close="open=false">
    <form @submit.prevent="save" class="space-y-5">
      <FormSection :step="1" title="Basic identity" description="Core information used to create the permanent patient record.">
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField label="First name" required><BaseInput v-model="f.firstName" required /></FormField>
          <FormField label="Last name" required><BaseInput v-model="f.lastName" required /></FormField>
          <FormField label="NIC"><BaseInput v-model="f.nic" placeholder="e.g. 901234567V" /></FormField>
          <FormField label="Date of birth" required><BaseInput v-model="f.dateOfBirth" type="date" required /></FormField>
          <FormField label="Gender"><BaseSelect v-model="f.gender"><option>Male</option><option>Female</option><option>Other</option></BaseSelect></FormField>
          <FormField label="Blood group"><BaseSelect v-model="f.bloodGroup"><option v-for="x in bloodGroups" :key="x">{{x}}</option></BaseSelect></FormField>
        </div>
      </FormSection>

      <FormSection :step="2" title="Physical & contact details" description="Demographic clues that may also support later ECIS searches." bordered>
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField label="Height (cm)"><BaseInput v-model.number="f.heightCm" type="number" min="1" step="0.1" /></FormField>
          <FormField label="Weight (kg)"><BaseInput v-model.number="f.weightKg" type="number" min="1" step="0.1" /></FormField>
          <FormField label="Phone"><BaseInput v-model="f.phone" /></FormField>
          <FormField label="Email"><BaseInput v-model="f.email" type="email" /></FormField>
          <FormField label="Province"><BaseSelect v-model="f.province"><option v-for="x in provinces" :key="x">{{x}}</option></BaseSelect></FormField>
          <FormField label="District"><BaseInput v-model="f.district" /></FormField>
          <div class="sm:col-span-2"><FormField label="Workplace"><BaseInput v-model="f.workplace" placeholder="Employer or workplace name" /></FormField></div>
          <div class="sm:col-span-2"><FormField label="Address"><BaseTextarea v-model="f.address" placeholder="Residential address" /></FormField></div>
        </div>
      </FormSection>

      <FormSection :step="3" title="Allergy information" description="Keep food and medical/drug allergies separate for safer clinical use." bordered>
        <div class="grid gap-4 sm:grid-cols-2"><TagInput v-model="f.foodAllergies" label="Food allergies" placeholder="e.g. Peanuts, seafood, milk" /><TagInput v-model="f.medicalAllergies" label="Medical / drug allergies" placeholder="e.g. Penicillin, aspirin" /></div>
      </FormSection>

      <div class="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <BaseButton variant="secondary" type="button" @click="open=false">Cancel</BaseButton>
        <BaseButton type="submit"><template #icon><UserPlus :size="16" /></template>Register patient</BaseButton>
      </div>
    </form>
  </Modal>
</div>
</template>
<script setup lang="ts">
import {computed,reactive,ref} from 'vue';import {RouterLink} from 'vue-router';import {UserPlus} from 'lucide-vue-next'
import PageHeader from '../components/PageHeader.vue';import Modal from '../components/Modal.vue';import TagInput from '../components/TagInput.vue';import BaseButton from '../components/ui/BaseButton.vue';import BaseInput from '../components/ui/BaseInput.vue';import BaseSelect from '../components/ui/BaseSelect.vue';import BaseTextarea from '../components/ui/BaseTextarea.vue';import SectionCard from '../components/ui/SectionCard.vue';import FormField from '../components/forms/FormField.vue';import FormSection from '../components/forms/FormSection.vue';import {useEHR} from '../stores/ehr'
const {patients,addPatient}=useEHR();const open=ref(false),q=ref(''),gender=ref('');const bloodGroups=['O+','O-','A+','A-','B+','B-','AB+','AB-'];const provinces=['Western Province','Central Province','Southern Province','Northern Province'];const f=reactive<any>({firstName:'',lastName:'',nic:'',dateOfBirth:'',gender:'Male',bloodGroup:'O+',phone:'',email:'',address:'',province:'Western Province',district:'Colombo',heightCm:170,weightKg:70,allergies:[],foodAllergies:[],medicalAllergies:[],chronicDiseases:[],workplace:''});const filtered=computed(()=>patients.value.filter(p=>`${p.firstName} ${p.lastName} ${p.patientNumber} ${p.nic}`.toLowerCase().includes(q.value.toLowerCase())&&(!gender.value||p.gender===gender.value)));function age(d:string){return Math.floor((Date.now()-new Date(d).getTime())/31557600000)}function save(){addPatient({...f,allergies:[...f.foodAllergies,...f.medicalAllergies]});open.value=false;Object.assign(f,{firstName:'',lastName:'',nic:'',dateOfBirth:'',phone:'',email:'',address:'',district:'Colombo',workplace:'',foodAllergies:[],medicalAllergies:[],allergies:[]});alert('Patient registered successfully.')}
</script>
