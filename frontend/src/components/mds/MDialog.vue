<script setup>
import { computed, onBeforeUnmount, watch } from 'vue';
import MButton from './MButton.vue';

const props = defineProps({ modelValue: { type: Boolean, default: false }, title: { type: String, default: '' }, type: { type: String, default: 'default', validator: (value) => ['default', 'confirm', 'danger'].includes(value) }, confirmText: { type: String, default: '' }, cancelText: { type: String, default: 'Hủy' } });
const emit = defineEmits(['update:modelValue', 'confirm', 'cancel']);
const primaryLabel = computed(() => props.confirmText || (props.type === 'danger' ? 'Xóa' : props.type === 'confirm' ? 'Đồng ý' : 'Đóng'));
const showCancel = computed(() => props.type !== 'default');
function close() { emit('update:modelValue', false); }
function cancel() { emit('cancel'); close(); }
function confirm() { emit('confirm'); close(); }
function onKeydown(event) { if (event.key === 'Escape') cancel(); }
watch(() => props.modelValue, (open) => {
  if (open) { document.addEventListener('keydown', onKeydown); document.body.style.overflow = 'hidden'; }
  else { document.removeEventListener('keydown', onKeydown); document.body.style.overflow = ''; }
});
onBeforeUnmount(() => { document.removeEventListener('keydown', onKeydown); document.body.style.overflow = ''; });
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" :aria-label="title">
      <section class="flex w-full max-w-[480px] flex-col rounded-lg bg-[var(--mds-bg)] shadow-xl"><header class="px-5 pb-2 pt-4"><h2 class="text-[16px] font-semibold leading-[22px] text-[var(--mds-text)]">{{ title }}</h2></header><div class="px-5 py-2 text-[13px] leading-[18px] text-[var(--mds-text)]"><slot /></div><footer class="flex items-center justify-end gap-2 px-5 pb-4 pt-3"><MButton v-if="showCancel" variant="neutral" @click="cancel">{{ cancelText }}</MButton><MButton :variant="type === 'danger' ? 'danger' : 'primary'" @click="confirm">{{ primaryLabel }}</MButton></footer></section>
    </div>
  </Teleport>
</template>
