<script setup>
const props = defineProps({ modelValue: { type: [String, Number, Boolean], default: undefined }, options: { type: Array, default: () => [] }, direction: { type: String, default: 'horizontal', validator: (value) => ['horizontal', 'vertical'].includes(value) }, disabled: { type: Boolean, default: false } });
const emit = defineEmits(['update:modelValue', 'change']);
const groupName = `m-radio-${Math.random().toString(36).slice(2, 9)}`;
function isDisabled(option) { return props.disabled || Boolean(option.disabled); }
function select(option, event) { if (!isDisabled(option) && option.value !== props.modelValue) { emit('update:modelValue', option.value); emit('change', option.value, event); } }
</script>

<template>
  <div role="radiogroup" class="flex" :class="direction === 'vertical' ? 'flex-col gap-2' : 'flex-row flex-wrap gap-x-4 gap-y-2'"><label v-for="option in options" :key="option.value" class="inline-flex items-center gap-2" :class="isDisabled(option) ? 'cursor-not-allowed' : 'cursor-pointer'"><input type="radio" class="sr-only" :name="groupName" :value="option.value" :checked="option.value === modelValue" :disabled="isDisabled(option)" @change="select(option, $event)" /><span class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors" :class="[option.value === modelValue ? isDisabled(option) ? 'border-[var(--mds-border)] bg-[var(--mds-bg-disabled)]' : 'border-[var(--mds-brand-600)] bg-[var(--mds-bg)]' : isDisabled(option) ? 'border-[var(--mds-border)] bg-[var(--mds-bg-disabled)]' : 'border-[var(--mds-border)] bg-[var(--mds-bg)] hover:border-[var(--mds-brand-600)]']"><span v-if="option.value === modelValue" class="h-2 w-2 rounded-full" :class="isDisabled(option) ? 'bg-[var(--mds-text-placeholder)]' : 'bg-[var(--mds-brand-600)]'" /></span><span class="select-none text-[13px] leading-[18px]" :class="isDisabled(option) ? 'text-[var(--mds-text-placeholder)]' : 'text-[var(--mds-text)]'">{{ option.label }}</span></label></div>
</template>
