<template>
  <div class="form-field">
    <label v-if="label" class="form-field__label">{{ label }}<span v-if="required" class="form-field__required">*</span></label>
    <div><slot /></div>
    <p v-if="hint" class="form-field__hint">{{ hint }}</p>
    <p v-if="error" class="form-field__error">{{ error }}</p>
  </div>
</template>
<script setup lang="ts">
defineProps<{label?:string;hint?:string;error?:string;required?:boolean}>()
</script>
