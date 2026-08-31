<script setup>
import { ref } from 'vue';

const props = defineProps({ modelValue: { type: [String, Number], default: null }, tabs: { type: Array, required: true } });
const emit = defineEmits(['update:modelValue', 'change']);
const tabRefs = ref([]);

function select(tab) {
  if (tab.disabled || tab.key === props.modelValue) return;
  emit('update:modelValue', tab.key);
  emit('change', tab.key);
}

function onKeydown(event, index) {
  const enabled = props.tabs.map((tab, tabIndex) => ({ tab, tabIndex })).filter(({ tab }) => !tab.disabled);
  const position = enabled.findIndex(({ tabIndex }) => tabIndex === index);
  let next;
  if (event.key === 'ArrowRight') next = enabled[(position + 1) % enabled.length];
  else if (event.key === 'ArrowLeft') next = enabled[(position - 1 + enabled.length) % enabled.length];
  else if (event.key === 'Home') next = enabled[0];
  else if (event.key === 'End') next = enabled[enabled.length - 1];
  if (!next) return;
  event.preventDefault();
  select(next.tab);
  tabRefs.value[next.tabIndex]?.focus();
}
</script>

<template>
  <div>
    <div role="tablist" class="flex items-center gap-1 border-b border-[var(--mds-border)]">
      <button v-for="(tab, index) in tabs" :key="tab.key" :ref="(element) => (tabRefs[index] = element)" type="button" role="tab" :aria-selected="tab.key === modelValue" :tabindex="tab.key === modelValue ? 0 : -1" :disabled="tab.disabled" class="relative -mb-px whitespace-nowrap px-3 py-2 text-[13px] font-medium leading-[18px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mds-brand-600)]" :class="tab.disabled ? 'cursor-not-allowed text-[var(--mds-text-placeholder)]' : tab.key === modelValue ? 'font-semibold text-[var(--mds-brand-600)]' : 'text-[var(--mds-text)] hover:text-[var(--mds-brand-600)]'" @click="select(tab)" @keydown="onKeydown($event, index)">
        {{ tab.label }}
        <span v-if="tab.key === modelValue" class="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--mds-brand-600)]" aria-hidden="true" />
      </button>
    </div>
    <div role="tabpanel"><slot /></div>
  </div>
</template>
