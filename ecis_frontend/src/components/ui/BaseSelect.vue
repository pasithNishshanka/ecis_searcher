<template>
  <select v-bind="$attrs" :value="modelValue" class="base-field" @change="onChange"><slot /></select>
</template>
<script setup lang="ts">
defineProps<{ modelValue?: string | number | null }>()
const emit = defineEmits<{ 'update:modelValue':[value:string] }>()
function onChange(event: Event){ emit('update:modelValue', (event.target as HTMLSelectElement).value) }
</script>
