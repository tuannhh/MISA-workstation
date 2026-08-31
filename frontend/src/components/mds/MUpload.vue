<script setup>
import { computed, ref } from 'vue';
import MIcon from '../MIcon.vue';

const props = defineProps({ accept: { type: String, default: '' }, multiple: { type: Boolean, default: true }, maxSizeMB: { type: Number, default: 5 }, disabled: { type: Boolean, default: false }, label: { type: String, default: 'Đính kèm' } });
const emit = defineEmits(['select-files', 'oversized']);
const inputRef = ref(null);
const isDragOver = ref(false);
const maxSizeBytes = computed(() => props.maxSizeMB * 1024 * 1024);
function pickFiles(fileList) { const files = Array.from(fileList || []); const valid = files.filter((file) => file.size <= maxSizeBytes.value); const oversized = files.filter((file) => file.size > maxSizeBytes.value); if (valid.length) emit('select-files', valid); if (oversized.length) emit('oversized', oversized); }
function onInput(event) { pickFiles(event.target.files); event.target.value = ''; }
function onDrop(event) { isDragOver.value = false; if (!props.disabled) pickFiles(event.dataTransfer?.files); }
</script>

<template>
  <div class="flex flex-col gap-2"><div class="flex items-center gap-2 text-[13px] text-[var(--mds-text)]"><MIcon name="paperclip" :size="16" class="text-[var(--mds-icon-neutral)]" /><span class="font-medium">{{ label }}</span><span class="text-[12px] text-[var(--mds-text-secondary)]">Tối đa {{ maxSizeMB }}MB/tệp</span></div><label class="flex h-[60px] w-full items-center justify-center rounded-lg border-[1.5px] border-dashed px-3 text-center text-[12px] transition-colors" :class="[disabled ? 'cursor-not-allowed border-[var(--mds-border)] text-[var(--mds-text-placeholder)]' : 'cursor-pointer text-[var(--mds-text-secondary)] hover:border-[var(--mds-brand-600)] hover:bg-[var(--mds-brand-50)]', isDragOver && !disabled ? 'border-[var(--mds-brand-600)] bg-[var(--mds-brand-50)]' : 'border-[var(--mds-border)]']" @click.prevent="!disabled && inputRef?.click()" @dragover.prevent="!disabled && (isDragOver = true)" @dragleave.prevent="isDragOver = false" @drop.prevent="onDrop">Kéo/thả tệp vào đây hoặc bấm để chọn<input ref="inputRef" class="hidden" type="file" :accept="accept" :multiple="multiple" :disabled="disabled" @change="onInput" /></label></div>
</template>
