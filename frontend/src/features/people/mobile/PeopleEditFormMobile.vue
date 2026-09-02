<script setup>
import { computed, reactive, ref, watch } from 'vue';
import MButton from '../../../components/mds/MButton.vue';
import MDialog from '../../../components/mds/MDialog.vue';
import MInput from '../../../components/mds/MInput.vue';
import MMobileTopBar from '../../../components/mds/MMobileTopBar.vue';
import { toPeopleEditDraft, toPeopleUpdatePayload, validatePeopleEditDraft } from '../domain/people-write.mjs';

const props = defineProps({ record: { type: Object, required: true }, saving: { type: Boolean, default: false }, serverError: { type: String, default: '' }, safeAreaStyle: { type: Object, default: () => ({}) } });
const emit = defineEmits(['cancel', 'save']);
const draft = reactive({});
const errors = reactive({});
const confirmDiscard = ref(false);
const initialDraft = ref('');
const fields = [
  ['full_name', 'Họ và tên', 'Nhập họ và tên', 'text'], ['position', 'Chức danh', 'Ví dụ: Phóng viên', 'text'],
  ['beat', 'Mảng phụ trách', 'Ví dụ: Kinh tế', 'text'], ['level', 'Cấp độ', 'Ví dụ: Senior', 'text'],
  ['email_work', 'Email công việc', 'name@example.com', 'email'], ['phone_work', 'Điện thoại công việc', 'Nhập số điện thoại', 'tel'],
  ['relationship_score', 'Điểm quan hệ', '0–100, nhập thủ công', 'number'], ['status', 'Trạng thái', 'Ví dụ: Active', 'text'],
];
const isDirty = computed(() => JSON.stringify(draft) !== initialDraft.value);
function resetDraft() { Object.assign(draft, toPeopleEditDraft(props.record)); initialDraft.value = JSON.stringify(draft); Object.keys(errors).forEach((key) => delete errors[key]); }
watch(() => props.record, resetDraft, { immediate: true });
function requestCancel() { if (props.saving) return; if (isDirty.value) { confirmDiscard.value = true; return; } emit('cancel'); }
function submit() { const nextErrors = validatePeopleEditDraft(draft); Object.keys(errors).forEach((key) => delete errors[key]); Object.assign(errors, nextErrors); if (Object.keys(nextErrors).length) return; emit('save', toPeopleUpdatePayload(draft)); }
</script>

<template>
  <section class="mds-mobile-app flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-[var(--mds-bg)] text-[var(--mds-text)]" :style="safeAreaStyle">
    <MMobileTopBar title="Chỉnh sửa hồ sơ" @back="requestCancel"><template #actions><MButton variant="link" :disabled="saving" @click="requestCancel">Hủy</MButton></template></MMobileTopBar>
    <form class="flex min-h-0 flex-1 flex-col" novalidate @submit.prevent="submit"><div class="min-h-0 flex-1 overflow-y-auto"><p class="mds-mobile-gutter-x border-b border-[var(--mds-border-light)] py-3 text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">Chỉ các trường trên màn hình được gửi. Máy chủ sẽ kiểm tra quyền lại khi lưu.</p><div class="mds-mobile-gutter-x space-y-4 py-4"><label v-for="[key, label, placeholder, type] in fields" :key="key" class="block"><span class="mb-1.5 block text-[13px] font-medium leading-[18px]">{{ label }}<span v-if="key === 'full_name'" class="ml-1 text-[var(--mds-danger)]" aria-hidden="true">*</span></span><MInput v-model="draft[key]" :type="type" :placeholder="placeholder" :error="errors[key]" :disabled="saving" /></label><p v-if="serverError" role="alert" class="rounded-lg bg-[var(--mds-danger-bg)] px-3 py-2 text-[13px] leading-[18px] text-[var(--mds-danger)]">{{ serverError }}</p></div></div><footer class="shrink-0 border-t border-[var(--mds-border-light)] bg-[var(--mds-bg)] px-4 pb-[calc(12px+var(--mds-mobile-safe-bottom))] pt-3"><MButton variant="primary" class="w-full" :loading="saving" :disabled="saving" @click="submit">Lưu thay đổi</MButton></footer></form>
    <MDialog v-model="confirmDiscard" title="Bỏ thay đổi?" type="danger" confirm-text="Bỏ thay đổi" @confirm="emit('cancel')"><p>Các thay đổi chưa lưu sẽ không được giữ lại.</p></MDialog>
  </section>
</template>
