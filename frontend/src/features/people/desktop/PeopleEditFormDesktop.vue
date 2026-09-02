<script setup>
import { nextTick, reactive, ref, watch } from 'vue';
import MButton from '../../../components/mds/MButton.vue';
import MInput from '../../../components/mds/MInput.vue';
import { toPeopleEditDraft, toPeopleUpdatePayload, validatePeopleEditDraft } from '../domain/people-write.mjs';

const props = defineProps({ record: { type: Object, required: true }, saving: { type: Boolean, default: false }, serverError: { type: String, default: '' } });
const emit = defineEmits(['cancel', 'save']);
const draft = reactive({});
const errors = reactive({});
const nameInput = ref(null);
const fields = [
  ['full_name', 'Họ và tên', 'Nhập họ và tên', 'text'], ['position', 'Chức danh', 'Ví dụ: Phóng viên', 'text'],
  ['beat', 'Mảng phụ trách', 'Ví dụ: Kinh tế', 'text'], ['level', 'Cấp độ', 'Ví dụ: Senior', 'text'],
  ['email_work', 'Email công việc', 'name@example.com', 'email'], ['phone_work', 'Điện thoại công việc', 'Nhập số điện thoại', 'tel'],
  ['relationship_score', 'Điểm quan hệ', '0–100, nhập thủ công', 'number'], ['status', 'Trạng thái', 'Ví dụ: Active', 'text'],
];
function resetDraft() { Object.assign(draft, toPeopleEditDraft(props.record)); Object.keys(errors).forEach((key) => delete errors[key]); }
watch(() => props.record, resetDraft, { immediate: true });
async function submit() {
  const nextErrors = validatePeopleEditDraft(draft);
  Object.keys(errors).forEach((key) => delete errors[key]);
  Object.assign(errors, nextErrors);
  if (Object.keys(nextErrors).length) { await nextTick(); nameInput.value?.focus(); return; }
  emit('save', toPeopleUpdatePayload(draft));
}
</script>

<template>
  <section class="min-h-0 bg-[var(--mds-bg-page)] p-4">
    <form class="mx-auto max-w-[960px] rounded-lg bg-[var(--mds-bg)] shadow-[var(--mds-shadow-card)]" novalidate @submit.prevent="submit">
      <header class="flex items-start justify-between gap-4 border-b border-[var(--mds-border-light)] px-5 py-4"><div><h1 class="text-[20px] font-semibold leading-7 text-[var(--mds-text)]">Chỉnh sửa hồ sơ</h1><p class="mt-1 text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">Chỉ các trường hiện trên màn hình được gửi để cập nhật. Máy chủ kiểm tra quyền một lần nữa khi lưu.</p></div><MButton variant="neutral" :disabled="saving" @click="emit('cancel')">Hủy</MButton></header>
      <div class="grid gap-x-5 gap-y-4 p-5 sm:grid-cols-2"><label v-for="[key, label, placeholder, type] in fields" :key="key" class="block"><span class="mb-1.5 block text-[13px] font-medium leading-[18px] text-[var(--mds-text)]">{{ label }}<span v-if="key === 'full_name'" class="ml-1 text-[var(--mds-danger)]" aria-hidden="true">*</span></span><MInput :ref="key === 'full_name' ? nameInput : undefined" v-model="draft[key]" :type="type" :placeholder="placeholder" :error="errors[key]" :disabled="saving" /></label></div>
      <p v-if="serverError" role="alert" class="mx-5 mb-4 rounded-lg bg-[var(--mds-danger-bg)] px-3 py-2 text-[13px] leading-[18px] text-[var(--mds-danger)]">{{ serverError }}</p>
      <footer class="flex justify-end gap-2 border-t border-[var(--mds-border-light)] px-5 py-3"><MButton variant="neutral" :disabled="saving" @click="emit('cancel')">Hủy</MButton><MButton variant="primary" :loading="saving" :disabled="saving" @click="submit">Lưu thay đổi</MButton></footer>
    </form>
  </section>
</template>
