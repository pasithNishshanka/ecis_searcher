<template>
  <button
    v-bind="$attrs"
    :type="type"
    :disabled="disabled || loading"
    :class="['base-button', `base-button--${variant}`, `base-button--${size}`, block && 'base-button--block']"
  >
    <span v-if="loading" class="button-spinner" aria-hidden="true"></span>
    <slot name="icon" />
    <span><slot /></span>
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
  block?: boolean
}>(), {
  variant: 'primary', size: 'md', type: 'button', disabled: false, loading: false, block: false
})
</script>

<style scoped>
.base-button{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;border:1px solid transparent;border-radius:.75rem;font-weight:700;line-height:1;transition:background-color .15s,border-color .15s,color .15s,box-shadow .15s,transform .05s;white-space:nowrap}
.base-button:active:not(:disabled){transform:translateY(1px)}
.base-button:disabled{cursor:not-allowed;opacity:.55}
.base-button--sm{min-height:34px;padding:.5rem .75rem;font-size:.75rem}
.base-button--md{min-height:40px;padding:.625rem 1rem;font-size:.8125rem}
.base-button--lg{min-height:44px;padding:.75rem 1.125rem;font-size:.875rem}
.base-button--block{width:100%}
.base-button--primary{background:var(--ecis-primary);color:white;box-shadow:0 1px 2px rgba(15,118,110,.12)}
.base-button--primary:hover:not(:disabled){background:var(--ecis-primary-hover)}
.base-button--secondary{background:white;border-color:#e2e8f0;color:#334155}
.base-button--secondary:hover:not(:disabled){background:#f0fdfa;border-color:#99f6e4;color:#115e59}
.base-button--danger{background:white;border-color:#fecaca;color:#b91c1c}
.base-button--danger:hover:not(:disabled){background:#fef2f2}
.base-button--ghost{background:transparent;color:#0f766e}
.base-button--ghost:hover:not(:disabled){background:#f0fdfa}
.button-spinner{width:.9rem;height:.9rem;border:2px solid currentColor;border-right-color:transparent;border-radius:999px;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
