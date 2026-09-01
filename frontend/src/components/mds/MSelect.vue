<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import MIcon from '../MIcon.vue';

// MDS DropDownList: dùng cho 4–8 lựa chọn, có keyboard và không dùng select gốc.
const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: null },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Chọn giá trị' },
  disabled: { type: Boolean, default: false },
  error: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'change', 'focus', 'blur']);
const open = ref(false);
const triggerRef = ref(null);
const popoverRef = ref(null);
const activeIndex = ref(-1);
const popoverStyle = ref({});
const selectedOption = computed(() => props.options.find((option) => option.value === props.modelValue));

function updatePosition() {
  const trigger = triggerRef.value;
  const popover = popoverRef.value;
  if (!trigger || !popover) return;
  const rect = trigger.getBoundingClientRect();
  const gap = 4;
  const popoverHeight = popover.offsetHeight;
  const popoverWidth = popover.offsetWidth;
  const openUp = window.innerHeight - rect.bottom < popoverHeight + gap && rect.top > popoverHeight + gap;
  popoverStyle.value = {
    position: 'fixed',
    left: `${Math.max(8, Math.min(rect.left, window.innerWidth - 8 - popoverWidth))}px`,
    top: openUp ? `${rect.top - popoverHeight - gap}px` : `${rect.bottom + gap}px`,
    minWidth: `${rect.width}px`,
  };
}
function openPopover() {
  if (props.disabled || open.value) return;
  open.value = true;
  activeIndex.value = props.options.findIndex((option) => option.value === props.modelValue && !option.disabled);
  if (activeIndex.value < 0) activeIndex.value = props.options.findIndex((option) => !option.disabled);
  nextTick(updatePosition);
}
function closePopover() { open.value = false; activeIndex.value = -1; }
function selectOption(option) {
  if (option.disabled) return;
  emit('update:modelValue', option.value);
  emit('change', option.value);
  closePopover();
  triggerRef.value?.focus();
}
function moveActive(direction) {
  if (!props.options.length) return;
  let index = activeIndex.value;
  for (let count = 0; count < props.options.length; count += 1) {
    index = (index + direction + props.options.length) % props.options.length;
    if (!props.options[index].disabled) { activeIndex.value = index; break; }
  }
}
function onKeydown(event) {
  if (props.disabled) return;
  if (!open.value) {
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); openPopover(); }
    return;
  }
  if (event.key === 'ArrowDown') { event.preventDefault(); moveActive(1); }
  else if (event.key === 'ArrowUp') { event.preventDefault(); moveActive(-1); }
  else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (activeIndex.value >= 0) selectOption(props.options[activeIndex.value]); }
  else if (event.key === 'Escape') { event.preventDefault(); closePopover(); }
  else if (event.key === 'Tab') closePopover();
}
function onPointerDown(event) {
  if (!triggerRef.value?.contains(event.target) && !popoverRef.value?.contains(event.target)) closePopover();
}
function reposition() { if (open.value) updatePosition(); }
watch(open, (isOpen) => {
  const action = isOpen ? 'addEventListener' : 'removeEventListener';
  document[action]('mousedown', onPointerDown);
  window[action]('scroll', reposition, true);
  window[action]('resize', reposition);
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onPointerDown);
  window.removeEventListener('scroll', reposition, true);
  window.removeEventListener('resize', reposition);
});
</script>

<template>
  <div class="w-full">
    <button ref="triggerRef" type="button" role="combobox" :aria-expanded="open" aria-haspopup="listbox" :disabled="disabled" class="flex h-[var(--mds-input-height)] w-full items-center justify-between gap-2 rounded-lg border px-3 text-left text-[13px] leading-[18px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mds-brand-600)]" :class="[error ? 'border-[var(--mds-danger)]' : 'border-[var(--mds-border)]', disabled ? 'cursor-not-allowed bg-[var(--mds-bg-disabled)]' : 'cursor-pointer bg-[var(--mds-bg)] hover:border-[var(--mds-brand-600)]']" @click="open ? closePopover() : openPopover()" @keydown="onKeydown" @focus="emit('focus', $event)" @blur="emit('blur', $event)">
      <span class="truncate" :class="selectedOption && !disabled ? 'text-[var(--mds-text)]' : 'text-[var(--mds-text-placeholder)]'">{{ selectedOption ? selectedOption.label : placeholder }}</span>
      <MIcon name="chevron-down" :size="16" class="text-[var(--mds-icon-neutral)] transition-transform" :class="open ? 'rotate-180' : ''" />
    </button>
    <Teleport to="body"><div v-if="open" ref="popoverRef" role="listbox" :style="popoverStyle" class="z-[1000] max-h-[264px] w-max max-w-[min(480px,calc(100vw-16px))] overflow-y-auto rounded-xl border border-[var(--mds-border)] bg-[var(--mds-bg)] py-1 shadow-lg"><div v-if="!options.length" class="px-3 py-2 text-[13px] text-[var(--mds-text-placeholder)]">Không có dữ liệu</div><div v-for="(option, index) in options" :key="option.value" role="option" :aria-selected="option.value === modelValue" :aria-disabled="option.disabled || undefined" :data-active="index === activeIndex" class="flex h-8 items-center gap-2 whitespace-nowrap px-3 text-[13px] leading-[18px]" :class="[option.disabled ? 'cursor-not-allowed text-[var(--mds-text-placeholder)]' : 'cursor-pointer text-[var(--mds-text)]', !option.disabled && index === activeIndex ? 'bg-[var(--mds-bg-hover-soft)]' : '', option.value === modelValue && !option.disabled ? 'font-medium text-[var(--mds-brand-600)]' : '']" @mouseenter="!option.disabled && (activeIndex = index)" @click="selectOption(option)"><span class="flex-1">{{ option.label }}</span><MIcon v-if="option.value === modelValue" name="check" :size="16" class="text-[var(--mds-brand-600)]" /></div></div></Teleport>
    <p v-if="error" class="mt-1 text-[12px] leading-4 text-[var(--mds-danger)]">{{ error }}</p>
  </div>
</template>
