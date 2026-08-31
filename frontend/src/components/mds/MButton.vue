<script setup>
import { computed } from 'vue';
import MSpinner from './MSpinner.vue';

const props = defineProps({
  variant: { type: String, default: 'secondary', validator: (value) => ['primary', 'secondary', 'neutral', 'ghost', 'danger', 'link', 'icon'].includes(value) },
  size: { type: String, default: 'md', validator: (value) => ['md', 'lg'].includes(value) },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
});

const isDisabled = computed(() => props.disabled || props.loading);
const sizeClasses = computed(() => {
  if (props.variant === 'icon') return props.size === 'lg' ? 'h-[calc(var(--mds-btn-height)+8px)] w-[calc(var(--mds-btn-height)+8px)]' : 'h-[var(--mds-btn-height)] w-[var(--mds-btn-height)]';
  return props.size === 'lg' ? 'h-[calc(var(--mds-btn-height)+8px)] min-w-[88px] px-4' : 'h-[var(--mds-btn-height)] min-w-[80px] px-[14px]';
});
const variantClasses = computed(() => {
  if (isDisabled.value) return ['link', 'icon', 'ghost'].includes(props.variant) ? 'cursor-not-allowed text-[var(--mds-text-placeholder)]' : 'cursor-not-allowed bg-[var(--mds-bg-disabled)] text-[var(--mds-text-placeholder)]';
  if (props.variant === 'primary') return 'bg-[var(--mds-brand-600)] text-white hover:bg-[var(--mds-brand-700)] active:bg-[var(--mds-brand-800)]';
  if (props.variant === 'danger') return 'bg-[var(--mds-danger)] text-white hover:brightness-95 active:brightness-90';
  if (props.variant === 'link') return 'text-[var(--mds-brand-600)] hover:underline active:text-[var(--mds-brand-800)]';
  if (props.variant === 'icon') return 'text-[var(--mds-icon-neutral)] hover:bg-[var(--mds-bg-hover-soft)] active:bg-[var(--mds-brand-100)]';
  if (props.variant === 'ghost') return 'bg-transparent text-[var(--mds-text-secondary)] hover:bg-[var(--mds-bg-hover-soft)] active:bg-[var(--mds-brand-100)]';
  return 'border border-[var(--mds-border)] bg-[var(--mds-bg)] text-[var(--mds-text)] hover:bg-[var(--mds-bg-hover-soft)] active:bg-[var(--mds-brand-100)]';
});
</script>

<template>
  <button type="button" :disabled="isDisabled" :aria-busy="loading || undefined" class="mds-button inline-flex max-w-full shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-[13px] font-medium leading-[18px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mds-brand-600)]" :class="[sizeClasses, variantClasses]">
    <MSpinner v-if="loading" :size="16" />
    <span v-else-if="$slots.icon" class="inline-flex shrink-0 [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true"><slot name="icon" /></span>
    <span class="min-w-0 truncate"><slot /></span>
  </button>
</template>
