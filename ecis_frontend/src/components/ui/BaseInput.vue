<template>
  <input v-bind="$attrs" :value="modelValue" class="base-field" @input="onInput" />
</template>
<script setup lang="ts">
import { useAttrs } from 'vue'
const attrs = useAttrs()
const props = defineProps<{ modelValue?: string | number | null }>()
const emit = defineEmits<{ 'update:modelValue':[value:string] }>()
function onInput(event: Event){ emit('update:modelValue', (event.target as HTMLInputElement).value) }
</script>
