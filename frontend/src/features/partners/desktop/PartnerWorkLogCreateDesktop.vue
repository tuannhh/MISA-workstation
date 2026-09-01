<script setup>
import { nextTick, reactive, ref } from 'vue';
import MButton from '../../../components/mds/MButton.vue';
import MInput from '../../../components/mds/MInput.vue';
import MSelect from '../../../components/mds/MSelect.vue';
import { toWorkLogCreatePayload, toWorkLogDraft, validateWorkLogDraft, WORK_LOG_CATEGORY_OPTIONS } from '../domain/partner-cooperation.mjs';

const props = defineProps({ saving: { type: Boolean, default: false }, serverError: { type: String, default: '' } });
const emit = defineEmits(['cancel', 'save']);
const draft = reactive(toWorkLogDraft());
const errors = reactive({});
const topicInput = ref(null);
async function submit() {
  const nextErrors = validateWorkLogDraft(draft);
  Object.keys(errors).forEach((key) => delete errors[key]); Object.assign(errors, nextErrors);
  if (Object.keys(nextErrors).length) { await nextTick(); topicInput.value?.focus(); return; }
  emit('save', toWorkLogCreatePayload(draft));
}
</script>

<template>
  <section class="min-h-0 bg-[var(--mds-bg-page)] p-4"><form class="mx-auto flex min-h-[calc(100vh-144px)] max-w-[800px] flex-col rounded-lg bg-[var(--mds-bg)] shadow-[var(--mds-shadow-card)]" novalidate @submit.prevent="submit"><header class="flex items-start justify-between gap-4 border-b border-[var(--mds-border-light)] px-5 py-4"><div><h1 class="text-[20px] font-semibold leading-7 text-[var(--mds-text)]">Ghi nhận làm việc</h1><p class="mt-1 text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">Trạng thái được khởi tạo là “Đang xử lý”. Máy chủ quyết định quyền tạo.</p></div><MButton variant="neutral" :disabled="saving" @click="emit('cancel')">Hủy</MButton></header><div class="grid flex-1 content-start gap-4 p-5 sm:grid-cols-2"><label class="block"><span class="mb-1.5 block text-[13px] font-medium leading-[18px]">Loại làm việc<span class="ml-1 text-[var(--mds-danger)]" aria-hidden="true">*</span></span><MSelect v-model="draft.category" :options="WORK_LOG_CATEGORY_OPTIONS" :error="errors.category" :disabled="saving" /></label><label class="block"><span class="mb-1.5 block text-[13px] font-medium leading-[18px]">Ngày làm việc<span class="ml-1 text-[var(--mds-danger)]" aria-hidden="true">*</span></span><MInput v-model="draft.work_date" type="date" :error="errors.work_date" :disabled="saving" /></label><label class="block sm:col-span-2"><span class="mb-1.5 block text-[13px] font-medium leading-[18px]">Nội dung làm việc<span class="ml-1 text-[var(--mds-danger)]" aria-hidden="true">*</span></span><MInput ref="topicInput" v-model="draft.topic" placeholder="Nhập nội dung cần theo dõi" :error="errors.topic" :disabled="saving" /></label><p v-if="serverError" role="alert" class="sm:col-span-2 rounded-lg bg-[var(--mds-danger-bg)] px-3 py-2 text-[13px] leading-[18px] text-[var(--mds-danger)]">{{ serverError }}</p></div><footer class="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--mds-border-light)] bg-[var(--mds-bg)] px-5 py-3"><MButton variant="neutral" :disabled="saving" @click="emit('cancel')">Hủy</MButton><MButton variant="primary" :loading="saving" :disabled="saving" @click="submit">Lưu lịch sử</MButton></footer></form></section>
</template>
