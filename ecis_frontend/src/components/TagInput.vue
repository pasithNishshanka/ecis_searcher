<template>
  <div>
    <label v-if="label" class="label">{{ label }}</label>
    <div class="flex gap-2">
      <BaseInput v-model="draft" :placeholder="placeholder" @keydown.enter.prevent="add" />
      <BaseButton type="button" variant="secondary" size="sm" @click="add">Add</BaseButton>
    </div>
    <div v-if="modelValue.length" class="mt-2 flex flex-wrap gap-2">
      <span v-for="item in modelValue" :key="item" class="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800">
        {{ item }}
        <button type="button" class="grid size-4 place-items-center rounded-full text-teal-600 hover:bg-teal-100" :aria-label="`Remove ${item}`" @click="remove(item)">×</button>
      </span>
    </div>
    <p v-else class="mt-1.5 text-[11px] text-slate-400">Add an allergy and press Enter or Add.</p>
  </div>
</template>
<script setup lang="ts">
import {ref} from 'vue';import BaseButton from './ui/BaseButton.vue';import BaseInput from './ui/BaseInput.vue'
const props=withDefaults(defineProps<{modelValue:string[];label?:string;placeholder?:string}>(),{label:'',placeholder:'Type an allergy...'})
const emit=defineEmits<{ 'update:modelValue':[value:string[]] }>();const draft=ref('')
function add(){const value=draft.value.trim();if(!value)return;if(!props.modelValue.some(item=>item.toLowerCase()===value.toLowerCase()))emit('update:modelValue',[...props.modelValue,value]);draft.value=''}
function remove(item:string){emit('update:modelValue',props.modelValue.filter(value=>value!==item))}
</script>
