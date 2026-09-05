<template>
  <div class="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div>
      <p v-if="eyebrow" class="mb-1 text-xs font-black uppercase tracking-[0.18em] text-teal-700">{{ eyebrow }}</p>
      <h1 class="text-2xl font-black tracking-tight text-slate-950">{{ title }}</h1>
      <p v-if="description" class="mt-1 max-w-3xl text-sm text-slate-500">{{ description }}</p>
    </div>
    <div><slot /></div>
  </div>
</template>
<script setup lang="ts">
defineProps<{eyebrow?:string,title:string,description?:string}>()
</script>
