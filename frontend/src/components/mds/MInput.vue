<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  error: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'change', 'focus', 'blur']);
const inputRef = ref(null);
const hasError = computed(() => Boolean(props.error));
function onInput(event) {
  let value = event.target.value;
  if (props.type === 'number' && value !== '') value = Number(value);
  emit('update:modelValue', value);
}
function onFocus(event) { event.target.select(); emit('focus', event); }
defineExpose({ focus: () => inputRef.value?.focus() });
</script>

<template>
  <div class="w-full">
    <div class="flex h-[var(--mds-input-height)] w-full items-center rounded-lg border bg-[var(--mds-bg)] px-3 transition-colors" :class="[hasError ? 'border-[var(--mds-danger)]' : 'border-[var(--mds-border)]', disabled ? 'cursor-not-allowed bg-[var(--mds-bg-disabled)]' : !readonly && !hasError ? 'hover:border-[var(--mds-brand-600)] focus-within:border-[var(--mds-brand-600)] focus-within:shadow-[0_0_0_3px_rgba(4,153,228,0.12)]' : '']">
      <input ref="inputRef" :type="type" :value="modelValue" :placeholder="placeholder" :disabled="disabled" :readonly="readonly" class="h-full min-w-0 flex-1 bg-transparent text-[13px] leading-[18px] text-[var(--mds-text)] outline-none placeholder:text-[var(--mds-text-placeholder)]" :class="disabled ? 'cursor-not-allowed' : ''" @input="onInput" @change="emit('change', $event)" @focus="onFocus" @blur="emit('blur', $event)" />
    </div>
    <p v-if="error" class="mt-1 text-[12px] leading-4 text-[var(--mds-danger)]">{{ error }}</p>
  </div>
</template>
