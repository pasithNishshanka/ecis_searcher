<template>
  <FormField :label="label" :hint="hint">
    <div class="grid grid-cols-2 gap-2">
      <BaseInput v-model="minProxy" type="number" :min="min" :max="max" :step="step" placeholder="Min" />
      <BaseInput v-model="maxProxy" type="number" :min="min" :max="max" :step="step" placeholder="Max" />
    </div>
  </FormField>
</template>
<script setup lang="ts">
import {computed} from 'vue'
import FormField from './FormField.vue'
import BaseInput from '../ui/BaseInput.vue'
const props=withDefaults(defineProps<{label:string;minValue?:number;maxValue?:number;min?:number;max?:number;step?:number;hint?:string}>(),{min:0,step:1})
const emit=defineEmits<{ 'update:minValue':[value:number|undefined]; 'update:maxValue':[value:number|undefined] }>()
const minProxy=computed({get:()=>props.minValue ?? '',set:(v:string|number)=>emit('update:minValue',v===''?undefined:Number(v))})
const maxProxy=computed({get:()=>props.maxValue ?? '',set:(v:string|number)=>emit('update:maxValue',v===''?undefined:Number(v))})
</script>
