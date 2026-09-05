<template>
<div>
<PageHeader eyebrow="Hospital overview" title="Good morning, Clinical Staff" description="A complete frontend demonstration of the ECIS research workflow.">
<RouterLink to="/ecis"><BaseButton><template #icon><Search :size="16" /></template>Open ECIS</BaseButton></RouterLink>
</PageHeader>
<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
<StatCard label="Registered patients" :value="patients.length" hint="Core EHR records"/>
<StatCard label="Treatment records" :value="treatments.length" hint="OPD, surgery, procedures"/>
<StatCard label="Occupied beds" :value="occupiedBeds" :hint="`${availableBeds} available`"/>
<StatCard label="Unidentified cases" :value="unidentified" hint="Ready for ECIS"/>
</div>
<div class="mt-6 grid gap-6 xl:grid-cols-3">
<section class="card p-5 xl:col-span-2">
<div class="flex items-center justify-between"><div><h2 class="section-title">Research workflow</h2><p class="muted mt-1">Clinical data accumulates through normal hospital work.</p></div></div>
<div class="mt-6 grid gap-3 md:grid-cols-5">
<div v-for="(s,i) in workflow" :key="s" class="rounded-xl border border-slate-200 p-4"><p class="text-xs font-black text-teal-700">0{{i+1}}</p><p class="mt-2 text-sm font-bold">{{s}}</p></div>
</div>
</section>
<section class="card p-5"><h2 class="section-title">Emergency queue</h2><div class="mt-4 space-y-3">
<div v-for="e in emergencies.slice(0,4)" :key="e.id" class="rounded-xl bg-slate-50 p-3"><div class="flex justify-between gap-2"><b class="text-sm">{{e.id}}</b><span class="badge">{{e.status}}</span></div><p class="mt-1 text-xs text-slate-500">{{e.description}}</p></div>
<RouterLink to="/emergency"><BaseButton variant="secondary" block>Open emergency</BaseButton></RouterLink>
</div></section>
</div>
</div>
</template>
<script setup lang="ts">
import {computed} from 'vue';import {RouterLink} from 'vue-router';import {Search} from 'lucide-vue-next';import BaseButton from '../components/ui/BaseButton.vue';import PageHeader from '../components/PageHeader.vue';import StatCard from '../components/StatCard.vue';import {useEHR} from '../stores/ehr'
const {patients,treatments,wards,emergencies}=useEHR();const occupiedBeds=computed(()=>wards.value.reduce((n,w)=>n+w.beds.filter(b=>b.status==='OCCUPIED').length,0));const availableBeds=computed(()=>wards.value.reduce((n,w)=>n+w.beds.filter(b=>b.status==='AVAILABLE').length,0));const unidentified=computed(()=>emergencies.value.filter(e=>e.status==='UNIDENTIFIED').length);const workflow=['Register patient','OPD / Ward care','Surgery & procedures','Clinical findings saved','ECIS searches existing EHR']
</script>
