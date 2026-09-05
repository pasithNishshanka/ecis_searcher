<template>
  <textarea v-bind="$attrs" :value="modelValue" class="base-field base-textarea" @input="onInput"></textarea>
</template>
<script setup lang="ts">
defineProps<{ modelValue?: string | null }>()
const emit = defineEmits<{ 'update:modelValue':[value:string] }>()
function onInput(event: Event){ emit('update:modelValue', (event.target as HTMLTextAreaElement).value) }
</script>
