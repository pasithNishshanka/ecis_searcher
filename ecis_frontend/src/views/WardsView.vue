<template>
  <div>
    <PageHeader eyebrow="Inpatient department" title="Wards & Beds"
      description="Quickly view ward occupancy, bed status and the patient assigned to each bed.">
      <div class="flex flex-wrap gap-2">
        <BaseButton @click="showWardForm = true"><template #icon>
            <Plus :size="16" />
          </template>Add ward</BaseButton>
      </div>
    </PageHeader>

    <!-- Quick ward access -->
    <div class="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <button v-for="w in wards" :key="w.id" @click="scrollToWard(w.id)"
        class="card p-4 text-left transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md">
        <div class="flex items-center justify-between">
          <span class="text-xs font-black uppercase tracking-wider text-teal-700">{{ w.department }}</span>
          <span class="text-xs font-bold text-slate-400">Floor {{ w.floor }}</span>
        </div>
        <h3 class="mt-2 font-black text-slate-900">{{ w.name }}</h3>
        <div class="mt-3 flex justify-between text-xs">
          <span>{{ occ(w) }} occupied</span>
          <b class="text-emerald-700">{{ w.capacity - occ(w) }} free</b>
        </div>
        <div class="mt-2 h-1.5 rounded-full bg-slate-100">
          <div class="h-1.5 rounded-full bg-teal-600" :style="{ width: `${w.capacity ? occ(w) / w.capacity * 100 : 0}%` }">
          </div>
        </div>
      </button>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <StatCard label="Total beds" :value="totalBeds" />
      <StatCard label="Occupied" :value="occupied" />
      <StatCard label="Available" :value="available" />
    </div>

    <div class="mt-6 space-y-5">
      <section v-for="w in wards" :key="w.id" :id="`ward-${w.id}`" class="card overflow-hidden scroll-mt-24">
        <div class="border-b bg-slate-50/70 p-5">
          <div class="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="section-title">{{ w.name }}</h2>
                <span class="badge">{{ w.id }}</span>
              </div>
              <p class="muted">{{ w.department }} · Floor {{ w.floor }} · {{ w.capacity }} beds</p>
            </div>
            <div class="flex gap-4 text-sm">
              <div><b>{{ occ(w) }}</b><span class="ml-1 text-slate-400">occupied</span></div>
              <div><b class="text-emerald-700">{{ w.capacity - occ(w) }}</b><span
                  class="ml-1 text-slate-400">available</span>
              </div>
            </div>
          </div>
          <div class="mt-4 h-2 rounded-full bg-slate-200">
            <div class="h-2 rounded-full bg-teal-600" :style="{ width: `${w.capacity ? occ(w) / w.capacity * 100 : 0}%` }">
            </div>
          </div>
        </div>

        <div class="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="b in w.beds" :key="b.id" class="rounded-xl border p-4"
            :class="b.status === 'OCCUPIED' ? 'border-blue-100 bg-blue-50/50' : b.status === 'MAINTENANCE' ? 'border-amber-100 bg-amber-50/50' : 'border-emerald-100 bg-emerald-50/40'">
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-xs font-black uppercase tracking-wider text-slate-400">Bed</p>
                <p class="mt-1 text-lg font-black text-slate-900">{{ b.number }}</p>
              </div>
              <span class="badge"
                :class="b.status === 'OCCUPIED' ? 'bg-blue-100 text-blue-700' : b.status === 'MAINTENANCE' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'">{{ b.status }}</span>
            </div>

            <div v-if="b.patientId" class="mt-4 rounded-xl bg-white p-3">
              <p class="text-[10px] font-black uppercase tracking-wider text-slate-400">Current patient</p>
              <p class="mt-1 font-bold">{{ patientName(b.patientId) }}</p>
              <p class="text-xs text-slate-400">{{ b.patientId }}</p>
              <div class="mt-3 flex gap-2">
                <RouterLink :to="`/patients/${b.patientId}`" class="flex-1">
                  <BaseButton variant="secondary" block size="sm">Patient EHR</BaseButton>
                </RouterLink>
                <BaseButton variant="secondary" size="sm" @click="viewPatient(b.patientId)">View</BaseButton>
              </div>
            </div>

            <div v-else-if="b.status === 'AVAILABLE'" class="mt-4">
              <BaseButton block @click="openAssignment(w, b)"><template #icon>
                  <UserPlus :size="15" />
                </template>Assign
                patient</BaseButton>
            </div>
            <div v-else class="mt-4 text-xs text-amber-700">This bed is unavailable for assignment.</div>
          </div>
        </div>
      </section>
    </div>

    <!-- Add ward -->
    <Modal :open="showWardForm" title="Add hospital ward"
      description="Ward and bed capacity are configurable for each hospital." @close="showWardForm = false">
      <form @submit.prevent="saveWard" class="grid gap-4 sm:grid-cols-2">
        <FormField label="Ward name" required>
          <BaseInput v-model="wf.name" placeholder="Medical Ward B" required />
        </FormField>
        <FormField label="Department" required>
          <BaseInput v-model="wf.department" placeholder="Medicine" required />
        </FormField>
        <FormField label="Floor" required>
          <BaseInput v-model="wf.floor" placeholder="3" required />
        </FormField>
        <FormField label="Bed count" required>
          <BaseInput v-model.number="wf.capacity" type="number" min="1" max="200" required />
        </FormField>
        <div class="sm:col-span-2 flex justify-end">
          <BaseButton type="submit">Create ward</BaseButton>
        </div>
      </form>
    </Modal>

    <!-- Scalable assignment modal: search, don't load 1000 options -->
    <Modal :open="!!assignment" title="Assign patient to bed"
      description="Search the registered patient by name, patient ID or NIC. No large dropdown is required."
      @close="assignment = null">
      <div v-if="assignment">
        <div class="rounded-xl bg-slate-50 p-4">
          <p class="text-xs font-bold text-slate-400">Selected bed</p>
          <p class="font-black">{{ assignment.b.number }} · {{ assignment.w.name }}</p>
        </div>

        <FormField class="mt-5" label="Search registered patient">
          <div class="relative">
            <BaseInput v-model="patientSearch" class="pr-10" placeholder="Type name, patient ID or NIC..." autofocus />
            <BaseButton v-if="patientSearch" variant="ghost" size="sm" type="button"
              class="absolute right-1 top-1 min-h-8 px-2" @click="patientSearch = ''">×</BaseButton>
          </div>
        </FormField>

        <div class="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-200">
          <button v-for="p in patientMatches" :key="p.id" @click="selectedPatient = p.id"
            class="flex w-full items-center gap-3 border-b border-slate-100 p-3 text-left last:border-0 hover:bg-teal-50"
            :class="selectedPatient === p.id ? 'bg-teal-50' : ''">
            <div class="avatar">{{ p.firstName[0] }}{{ p.lastName[0] }}</div>
            <div class="min-w-0 flex-1">
              <p class="font-bold">{{ p.firstName }} {{ p.lastName }}</p>
              <p class="text-xs text-slate-400">{{ p.patientNumber }} · {{ p.nic || 'NIC not recorded' }} · {{ p.district }}
              </p>
            </div>
            <span v-if="selectedPatient === p.id" class="font-black text-teal-700">✓</span>
          </button>
          <div v-if="!patientSearch" class="p-5 text-center text-xs text-slate-400">Start typing to find a patient.
          </div>
          <div v-else-if="!patientMatches.length" class="p-5 text-center text-xs text-slate-400">No registered patient
            matches "{{ patientSearch }}".</div>
        </div>

        <div v-if="selectedPatient" class="mt-4 rounded-xl bg-teal-50 p-3 text-sm">
          Selected: <b>{{ patientName(selectedPatient) }}</b> · {{ selectedPatient }}
        </div>
        <BaseButton block class="mt-4" :disabled="!selectedPatient" @click="assign">Assign selected patient</BaseButton>
      </div>
    </Modal>

    <!-- Patient quick details -->
    <Modal :open="!!patientDetail" title="Current bed patient"
      description="Quick patient details from the existing EHR." @close="patientDetail = null">
      <div v-if="patientDetail" class="space-y-4">
        <div class="flex gap-3">
          <div class="avatar">{{ patientDetail.firstName[0] }}{{ patientDetail.lastName[0] }}</div>
          <div>
            <h3 class="font-black">{{ patientDetail.firstName }} {{ patientDetail.lastName }}</h3>
            <p class="text-xs text-slate-400">{{ patientDetail.patientNumber }}</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <Info label="Blood" :value="patientDetail.bloodGroup" />
          <Info label="Age" :value="`${age(patientDetail.dateOfBirth)} years`" />
          <Info label="Height" :value="`${patientDetail.heightCm} cm`" />
          <Info label="District" :value="patientDetail.district" />
        </div>
        <RouterLink :to="`/patients/${patientDetail.id}`">
          <BaseButton block>Open complete EHR</BaseButton>
        </RouterLink>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Plus, UserPlus } from 'lucide-vue-next'
import PageHeader from '../components/PageHeader.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseInput from '../components/ui/BaseInput.vue'
import FormField from '../components/forms/FormField.vue'
import StatCard from '../components/StatCard.vue'
import Modal from '../components/Modal.vue'
import { useEHR } from '../stores/ehr'

const Info = { props: ['label', 'value'], template: `<div class="rounded-xl bg-slate-50 p-3"><p class="label">{{label}}</p><p class="mt-1 text-sm font-bold">{{value}}</p></div>` }
const { wards, patients, addWard, assignBed } = useEHR()
const showWardForm = ref(false), assignment = ref<any>(null), patientSearch = ref(''), selectedPatient = ref(''), patientDetail = ref<any>(null)
const wf = reactive({ name: '', department: 'Medicine', floor: '1', capacity: 20 })
const totalBeds = computed(() => wards.value.reduce((n, w) => n + w.capacity, 0))
const occupied = computed(() => wards.value.reduce((n, w) => n + occ(w), 0))
const available = computed(() => totalBeds.value - occupied.value)
const patientMatches = computed(() => patients.value.filter(p => `${p.firstName} ${p.lastName} ${p.patientNumber} ${p.nic}`.toLowerCase().includes(patientSearch.value.toLowerCase())).slice(0, 20))
function occ(w: any) { return w.beds.filter((b: any) => b.status === 'OCCUPIED').length }
function patientName(id: string) { const p = patients.value.find(x => x.id === id); return p ? `${p.firstName} ${p.lastName}` : 'Unknown patient' }
function age(d: string) { return Math.floor((Date.now() - new Date(d).getTime()) / 31557600000) }
function saveWard() { addWard(wf.name, wf.department, wf.floor, wf.capacity); showWardForm.value = false; Object.assign(wf, { name: '', department: 'Medicine', floor: '1', capacity: 20 }) }
function openAssignment(w: any, b: any) { assignment.value = { w, b }; patientSearch.value = ''; selectedPatient.value = '' }
function assign() { if (!assignment.value || !selectedPatient.value) return; assignBed(assignment.value.w.id, assignment.value.b.id, selectedPatient.value); assignment.value = null; patientSearch.value = ''; selectedPatient.value = '' }
function viewPatient(id: string) { patientDetail.value = patients.value.find(p => p.id === id) || null }
function scrollToWard(id: string) { document.getElementById(`ward-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
</script>
