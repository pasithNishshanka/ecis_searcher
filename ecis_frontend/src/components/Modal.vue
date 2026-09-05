<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" @click.self="$emit('close')">
      <div class="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div class="flex items-start justify-between border-b border-slate-100 p-5">
          <div><h2 class="text-lg font-black">{{title}}</h2><p v-if="description" class="mt-1 text-xs text-slate-500">{{description}}</p></div>
          <button @click="$emit('close')" class="rounded-lg p-2 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <div class="p-5"><slot /></div>
      </div>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
defineProps<{open:boolean,title:string,description?:string}>()
defineEmits<{close:[]}>()
</script>
