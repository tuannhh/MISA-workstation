<script setup>
import { computed } from 'vue';

const props = defineProps({ color: { type: String, default: 'neutral', validator: (value) => ['brand', 'success', 'warning', 'danger', 'neutral'].includes(value) } });
const colorClasses = computed(() => ({
  brand: 'bg-[var(--mds-brand-100)] text-[var(--mds-brand-700)]',
  success: 'bg-[var(--mds-success-soft)] text-[var(--mds-success)]',
  warning: 'bg-[var(--mds-warning-soft)] text-[var(--mds-warning)]',
  danger: 'bg-[var(--mds-danger-soft)] text-[var(--mds-danger)]',
  neutral: 'bg-[var(--mds-bg-disabled)] text-[var(--mds-text)]',
}[props.color]));
</script>

<template><span class="mds-tag inline-flex h-6 max-w-full min-w-0 select-none items-center rounded px-2 text-[12px] font-medium leading-none" :class="colorClasses"><span class="min-w-0 truncate"><slot /></span></span></template>
