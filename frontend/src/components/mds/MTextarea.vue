<script setup>
import { computed } from 'vue';

const props = defineProps({ modelValue: { type: String, default: '' }, rows: { type: Number, default: 3 }, maxlength: { type: Number, default: null }, placeholder: { type: String, default: '' }, disabled: { type: Boolean, default: false }, error: { type: String, default: '' } });
const emit = defineEmits(['update:modelValue', 'change', 'focus', 'blur']);
const length = computed(() => (props.modelValue || '').length);
function onFocus(event) { event.target.select(); emit('focus', event); }
</script>

<template>
  <div class="w-full"><div class="relative w-full"><textarea :value="modelValue" :rows="rows" :maxlength="maxlength ?? undefined" :placeholder="placeholder" :disabled="disabled" class="w-full resize-y rounded-lg border bg-[var(--mds-bg)] px-3 py-[7px] text-[13px] leading-[18px] text-[var(--mds-text)] outline-none transition-colors placeholder:text-[var(--mds-text-placeholder)]" :class="[error ? 'border-[var(--mds-danger)]' : 'border-[var(--mds-border)]', disabled ? 'cursor-not-allowed bg-[var(--mds-bg-disabled)]' : !error ? 'hover:border-[var(--mds-brand-600)] focus:border-[var(--mds-brand-600)] focus:shadow-[0_0_0_2px_var(--mds-brand-100)]' : '', maxlength != null ? 'pb-5' : '']" @input="emit('update:modelValue', $event.target.value)" @change="emit('change', $event)" @focus="onFocus" @blur="emit('blur', $event)" /><span v-if="maxlength != null" class="pointer-events-none absolute bottom-2 right-3 text-[12px] leading-4 text-[var(--mds-text-placeholder)]" :title="`Còn ${Math.max(maxlength - length, 0)} ký tự được nhập`">{{ length }}/{{ maxlength }}</span></div><p v-if="error" class="mt-1 text-[12px] leading-4 text-[var(--mds-danger)]">{{ error }}</p></div>
</template>
