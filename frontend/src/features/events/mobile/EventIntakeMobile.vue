<script setup>
import { ref } from 'vue';
import MButton from '../../../components/mds/MButton.vue';
import MDialog from '../../../components/mds/MDialog.vue';
import MMobileTopBar from '../../../components/mds/MMobileTopBar.vue';
import MTextarea from '../../../components/mds/MTextarea.vue';
import MUpload from '../../../components/mds/MUpload.vue';

defineProps({ loading: Boolean, error: String, missing: { type: Array, default: () => [] }, warnings: { type: Array, default: () => [] }, safeAreaStyle: Object });
const emit = defineEmits(['cancel', 'extract']);
const text = ref(''); const file = ref(null); const localError = ref(''); const discard = ref(false);
function select(files) { file.value = files[0] || null; }
function submit() { const sourceCount = Number(Boolean(file.value)) + Number(Boolean(text.value.trim())); if (!sourceCount) { localError.value = 'Hãy dán nội dung hoặc chọn file Excel/CSV.'; return; } if (sourceCount > 1) { localError.value = 'Chỉ chọn một nguồn để AI bóc tách chính xác.'; return; } localError.value = ''; emit('extract', { text: text.value.trim(), file: file.value }); }
</script>

<template>
  <section class="mds-mobile-app flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-[var(--mds-bg)]" :style="safeAreaStyle">
    <MMobileTopBar title="AI bóc tách sự kiện" @back="discard = true"><template #actions><MButton variant="link" :disabled="loading" @click="discard = true">Hủy</MButton></template></MMobileTopBar>
    <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="submit"><div class="min-h-0 flex-1 overflow-y-auto"><div class="mds-mobile-gutter-x space-y-4 py-4"><p class="text-[13px] text-[var(--mds-text-secondary)]">AI chỉ tạo bản nháp; bạn kiểm tra trước khi lưu.</p><label><span class="mb-1 block text-[13px] font-medium">Kế hoạch hoặc thông báo sự kiện</span><MTextarea v-model="text" placeholder="Dán kế hoạch hoặc agenda…" :disabled="loading" /></label><MUpload label="Hoặc tải file Excel/CSV" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" :multiple="false" :disabled="loading" @select-files="select" /><p v-if="file" class="text-[12px] text-[var(--mds-text-secondary)]">Đã chọn: {{ file.name }}</p><p v-if="error || localError" role="alert" class="rounded-lg bg-[var(--mds-danger-bg)] px-3 py-2 text-[13px] text-[var(--mds-danger)]">{{ error || localError }}</p><div v-if="warnings.length || missing.length" class="space-y-2 rounded-lg bg-[var(--mds-warning-bg)] p-3 text-[13px]"><p v-if="warnings.length"><strong>Cảnh báo khi đọc tệp:</strong> {{ warnings.join(' · ') }}</p><p v-if="missing.length"><strong>Cần kiểm tra thêm:</strong> {{ missing.join(', ') }}</p></div></div></div><footer class="shrink-0 border-t border-[var(--mds-border-light)] bg-[var(--mds-bg)] px-4 pb-[calc(12px+var(--mds-mobile-safe-bottom))] pt-3"><MButton variant="primary" class="w-full" :loading="loading" @click="submit">Bóc tách thành bản nháp</MButton></footer></form>
    <MDialog v-model="discard" title="Bỏ bản nháp AI?" type="danger" confirm-text="Bỏ" @confirm="emit('cancel')"><p>Nội dung chưa bóc tách sẽ không được giữ lại.</p></MDialog>
  </section>
</template>
