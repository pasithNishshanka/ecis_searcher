<template>
  <div class="card p-5">
    <p class="text-xs font-bold uppercase tracking-wider text-slate-400">{{label}}</p>
    <p class="mt-2 text-3xl font-black text-slate-900">{{value}}</p>
    <p v-if="hint" class="mt-1 text-xs text-slate-500">{{hint}}</p>
  </div>
</template>
<script setup lang="ts">
defineProps<{label:string,value:string|number,hint?:string}>()
</script>
