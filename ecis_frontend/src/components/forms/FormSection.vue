<template>
  <section class="form-section" :class="bordered && 'form-section--bordered'">
    <div class="form-section__heading">
      <div v-if="step !== undefined" class="section-marker">{{ step }}</div>
      <div><h3>{{ title }}</h3><p v-if="description">{{ description }}</p></div>
    </div>
    <div :class="contentClass"><slot /></div>
  </section>
</template>
<script setup lang="ts">
defineProps<{step?:number|string;title:string;description?:string;bordered?:boolean;contentClass?:string}>()
</script>
<style scoped>
.form-section--bordered{border-top:1px solid #f1f5f9;padding-top:1.25rem}
.form-section__heading{display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem}
.form-section__heading h3{margin:0;font-size:.875rem;font-weight:800;color:#0f172a}
.form-section__heading p{margin:.125rem 0 0;font-size:.75rem;color:#94a3b8}
</style>
