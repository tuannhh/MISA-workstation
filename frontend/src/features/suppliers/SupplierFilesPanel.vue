<script setup>
import { ref } from 'vue';
import MEmptyState from '../../components/mds/MEmptyState.vue';
import MTag from '../../components/mds/MTag.vue';
import MUpload from '../../components/mds/MUpload.vue';
import { fileUrl } from './domain/supplier-detail.mjs';

const props = defineProps({ files: { type: Array, default: () => [] }, canUpload: { type: Boolean, default: false }, canOpen: { type: Boolean, default: false }, uploading: { type: Boolean, default: false }, error: { type: String, default: '' } });
const emit = defineEmits(['upload']);
const localError = ref('');
function oversized(files) { localError.value = `${files.length} tệp vượt quá 5MB nên chưa được tải lên.`; }
function select(files) { localError.value = ''; emit('upload', files); }
</script>

<template>
  <section class="space-y-4"><div><h2 class="text-[16px] font-semibold leading-[22px]">Báo giá và tệp đính kèm</h2><p class="mt-1 text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">Mọi role có thể thấy sự tồn tại tệp. Nội dung báo giá là dữ liệu hạn chế và chỉ quản trị viên được mở; máy chủ kiểm tra lại khi tải.</p></div><div v-if="files.length" class="divide-y divide-[var(--mds-border-light)] rounded-lg border border-[var(--mds-border-light)]"><div v-for="file in files" :key="file.id" class="flex min-h-[52px] items-center justify-between gap-3 px-3 py-2"><span class="min-w-0"><strong class="block truncate text-[13px]">{{ file.originalName }}</strong><span class="mt-0.5 block text-[12px] text-[var(--mds-text-secondary)]">{{ file.mime }}</span></span><a v-if="canOpen" :href="fileUrl(file.id)" target="_blank" rel="noopener" class="shrink-0 text-[13px] font-medium text-[var(--mds-brand-700)] hover:underline">Mở tệp</a><MTag v-else color="neutral" class="shrink-0">Hạn chế</MTag></div></div><MEmptyState v-else title="Chưa có tệp báo giá" description="Tệp báo giá sẽ xuất hiện ở đây sau khi được tải lên." /><MUpload v-if="canUpload" label="Tải tệp báo giá" accept="application/pdf,image/jpeg,image/png,image/webp,.doc,.docx,.xls,.xlsx" :disabled="uploading" @select-files="select" @oversized="oversized" /><p v-if="localError || error" role="alert" class="rounded-lg bg-[var(--mds-danger-bg)] px-3 py-2 text-[13px] leading-[18px] text-[var(--mds-danger)]">{{ localError || error }}</p></section>
</template>
