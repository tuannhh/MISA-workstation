<script setup>
import { ref } from 'vue';
import MButton from '../../../components/mds/MButton.vue';
import MTextarea from '../../../components/mds/MTextarea.vue';
import MUpload from '../../../components/mds/MUpload.vue';

defineProps({ loading: Boolean, error: String, missing: { type: Array, default: () => [] }, warnings: { type: Array, default: () => [] } });
const emit = defineEmits(['cancel', 'extract']);
const text = ref(''); const file = ref(null); const localError = ref('');
function select(files) { file.value = files[0] || null; }
function submit() { const sourceCount = Number(Boolean(file.value)) + Number(Boolean(text.value.trim())); if (!sourceCount) { localError.value = 'Hãy dán nội dung hoặc chọn file Excel/CSV.'; return; } if (sourceCount > 1) { localError.value = 'Chỉ chọn một nguồn để AI bóc tách chính xác.'; return; } localError.value = ''; emit('extract', { text: text.value.trim(), file: file.value }); }
</script>

<template>
  <section class="min-h-0 bg-[var(--mds-bg-page)] p-4">
    <form class="mx-auto max-w-[880px] rounded-lg bg-[var(--mds-bg)] shadow-[var(--mds-shadow-card)]" @submit.prevent="submit">
      <header class="flex items-start justify-between gap-4 border-b border-[var(--mds-border-light)] px-5 py-4">
        <div><h1 class="text-[20px] font-semibold">AI bóc tách sự kiện</h1><p class="mt-1 text-[13px] text-[var(--mds-text-secondary)]">AI chỉ tạo bản nháp. Bạn kiểm tra và chủ động lưu ở bước sau.</p></div>
        <MButton variant="neutral" :disabled="loading" @click="emit('cancel')">Hủy</MButton>
      </header>
      <div class="space-y-4 p-5">
        <label><span class="mb-1 block text-[13px] font-medium">Kế hoạch hoặc thông báo sự kiện</span><MTextarea v-model="text" placeholder="Dán kế hoạch, agenda hoặc thông báo sự kiện…" :disabled="loading" /></label>
        <MUpload label="Hoặc tải file Excel/CSV" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" :multiple="false" :disabled="loading" @select-files="select" />
        <p v-if="file" class="text-[12px] text-[var(--mds-text-secondary)]">Đã chọn: {{ file.name }}</p>
        <p v-if="error || localError" role="alert" class="rounded-lg bg-[var(--mds-danger-bg)] px-3 py-2 text-[13px] text-[var(--mds-danger)]">{{ error || localError }}</p>
        <div v-if="warnings.length || missing.length" class="space-y-2 rounded-lg bg-[var(--mds-warning-bg)] p-3 text-[13px] text-[var(--mds-text-primary)]"><p v-if="warnings.length"><strong>Cảnh báo khi đọc tệp:</strong> {{ warnings.join(' · ') }}</p><p v-if="missing.length"><strong>Cần kiểm tra thêm:</strong> {{ missing.join(', ') }}</p></div>
      </div>
      <footer class="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--mds-border-light)] bg-[var(--mds-bg)] px-5 py-3"><MButton variant="neutral" :disabled="loading" @click="emit('cancel')">Hủy</MButton><MButton variant="primary" :loading="loading" @click="submit">Bóc tách thành bản nháp</MButton></footer>
    </form>
  </section>
</template>
