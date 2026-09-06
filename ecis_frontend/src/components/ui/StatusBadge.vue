<template>
    <span :class="['status-badge', `status-badge--${tone}`]">
        <slot>{{ label }}</slot>
    </span>
</template>

<script setup lang="ts">
withDefaults(
    defineProps<{
        label?: string;
        tone?: "neutral" | "success" | "warning" | "danger" | "info";
    }>(),
    {
        tone: "neutral",
    }
);
</script>

<style scoped>
.status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border-radius: 999px;
    padding: 0.3rem 0.6rem;
    font-size: 0.6875rem;
    font-weight: 800;
}

.status-badge--neutral {
    background: #f1f5f9;
    color: #475569;
}

.status-badge--success {
    background: #ecfdf5;
    color: #047857;
}

.status-badge--warning {
    background: #fffbeb;
    color: #b45309;
}

.status-badge--danger {
    background: #fef2f2;
    color: #b91c1c;
}

.status-badge--info {
    background: #f0fdfa;
    color: #0f766e;
}
</style>