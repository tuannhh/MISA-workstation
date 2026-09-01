<script setup>
import { ref } from 'vue';
import MEmptyState from '../../components/mds/MEmptyState.vue';
import MSelect from '../../components/mds/MSelect.vue';
import MUpload from '../../components/mds/MUpload.vue';
import { eventFileUrl } from './domain/event-detail.mjs';

const props = defineProps({ files: { type: Array, default: () => [] }, canUpload: Boolean, uploading: Boolean, error: String });
const emit = defineEmits(['upload']);
const kind = ref('Tài liệu'); const localError = ref('');
const kinds = Object.freeze(['Tài liệu', 'Hợp đồng', 'Hóa đơn', 'Agenda', 'Dự toán', 'Bài diễn giả'].map((value) => ({ value, label: value })));
function oversized(files) { localError.value = `${files.length} tệp vượt quá 5MB nên chưa được tải lên.`; }
function select(files) { localError.value = ''; emit('upload', { kind: kind.value, files }); }
</script>

<template>
  <section class="space-y-4"><div><h2 class="text-[16px] font-semibold">Tệp đính kèm</h2><p class="mt-1 text-[13px] text-[var(--mds-text-secondary)]">Tên tệp là metadata được phép xem; khi mở tệp, máy chủ kiểm tra lại quyền truy cập.</p></div><div v-if="files.length" class="divide-y divide-[var(--mds-border-light)]"><div v-for="file in files" :key="file.id" class="flex min-h-[52px] items-center justify-between gap-3 py-2"><span class="min-w-0"><strong class="block truncate text-[13px]">{{ file.originalName }}</strong><span class="mt-0.5 block text-[12px] text-[var(--mds-text-secondary)]">{{ file.kind }} · {{ file.mime }}</span></span><a :href="eventFileUrl(file.id)" target="_blank" rel="noopener" class="shrink-0 text-[13px] font-medium text-[var(--mds-brand-700)] hover:underline">Mở tệp</a></div></div><MEmptyState v-else title="Chưa có tệp đính kèm" description="Tài liệu được phép xem sẽ xuất hiện ở đây."/><div v-if="canUpload" class="space-y-3 rounded-lg bg-[var(--mds-bg-page)] p-3"><label><span class="mb-1 block text-[13px] font-medium">Loại tài liệu</span><MSelect v-model="kind" :options="kinds" :disabled="uploading"/></label><MUpload label="Tải tệp sự kiện" accept="application/pdf,image/jpeg,image/png,image/webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx" :disabled="uploading" @select-files="select" @oversized="oversized"/></div><p v-if="localError || error" role="alert" class="rounded-lg bg-[var(--mds-danger-bg)] px-3 py-2 text-[13px] text-[var(--mds-danger)]">{{ localError || error }}</p></section>
</template>
