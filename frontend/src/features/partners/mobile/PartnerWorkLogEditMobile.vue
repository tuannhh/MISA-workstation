<script setup>
import { computed, reactive, ref, watch } from 'vue';
import MButton from '../../../components/mds/MButton.vue';
import MDialog from '../../../components/mds/MDialog.vue';
import MInput from '../../../components/mds/MInput.vue';
import MMobileTopBar from '../../../components/mds/MMobileTopBar.vue';
import MRadioGroup from '../../../components/mds/MRadioGroup.vue';
import MSelect from '../../../components/mds/MSelect.vue';
import MTextarea from '../../../components/mds/MTextarea.vue';
import { toWorkLogEditDraft, toWorkLogUpdatePayload, validateWorkLogDraft, WORK_LOG_CATEGORY_OPTIONS, WORK_LOG_STATUS_OPTIONS } from '../domain/partner-cooperation.mjs';

const props = defineProps({ record: { type: Object, required: true }, saving: { type: Boolean, default: false }, serverError: { type: String, default: '' }, safeAreaStyle: { type: Object, default: () => ({}) } });
const emit = defineEmits(['cancel', 'save']);
const draft = reactive({}); const errors = reactive({}); const confirmDiscard = ref(false); const initialDraft = ref('');
const isDirty = computed(() => JSON.stringify(draft) !== initialDraft.value);
function reset() { Object.assign(draft, toWorkLogEditDraft(props.record)); initialDraft.value = JSON.stringify(draft); Object.keys(errors).forEach((key) => delete errors[key]); }
watch(() => props.record, reset, { immediate: true });
function requestCancel() { if (!props.saving) { if (isDirty.value) confirmDiscard.value = true; else emit('cancel'); } }
function submit() { const nextErrors = validateWorkLogDraft(draft); Object.keys(errors).forEach((key) => delete errors[key]); Object.assign(errors, nextErrors); if (!Object.keys(nextErrors).length) emit('save', toWorkLogUpdatePayload(draft)); }
</script>

<template>
  <section class="mds-mobile-app flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-[var(--mds-bg)] text-[var(--mds-text)]" :style="safeAreaStyle"><MMobileTopBar title="Chỉnh sửa lịch sử" @back="requestCancel"><template #actions><MButton variant="link" :disabled="saving" @click="requestCancel">Hủy</MButton></template></MMobileTopBar><form class="flex min-h-0 flex-1 flex-col" novalidate @submit.prevent="submit"><div class="min-h-0 flex-1 overflow-y-auto"><p class="mds-mobile-gutter-x border-b border-[var(--mds-border-light)] py-3 text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">Máy chủ sẽ kiểm tra lại quyền chỉnh sửa trước khi lưu.</p><div class="mds-mobile-gutter-x space-y-4 py-4"><label class="block"><span class="mb-1.5 block text-[13px] font-medium leading-[18px]">Loại làm việc<span class="ml-1 text-[var(--mds-danger)]" aria-hidden="true">*</span></span><MSelect v-model="draft.category" :options="WORK_LOG_CATEGORY_OPTIONS" :error="errors.category" :disabled="saving" /></label><label class="block"><span class="mb-1.5 block text-[13px] font-medium leading-[18px]">Ngày làm việc<span class="ml-1 text-[var(--mds-danger)]" aria-hidden="true">*</span></span><MInput v-model="draft.work_date" type="date" :error="errors.work_date" :disabled="saving" /></label><label class="block"><span class="mb-1.5 block text-[13px] font-medium leading-[18px]">Nội dung làm việc<span class="ml-1 text-[var(--mds-danger)]" aria-hidden="true">*</span></span><MInput v-model="draft.topic" :error="errors.topic" :disabled="saving" /></label><fieldset class="block"><legend class="mb-1.5 text-[13px] font-medium leading-[18px]">Trạng thái</legend><MRadioGroup v-model="draft.status" :options="WORK_LOG_STATUS_OPTIONS" direction="vertical" :disabled="saving" /></fieldset><label class="block"><span class="mb-1.5 block text-[13px] font-medium leading-[18px]">Kết quả</span><MTextarea v-model="draft.result" :rows="3" maxlength="2000" :disabled="saving" /></label><label class="block"><span class="mb-1.5 block text-[13px] font-medium leading-[18px]">Nhân sự phụ trách</span><MInput v-model="draft.staff" :disabled="saving" /></label><label class="block"><span class="mb-1.5 block text-[13px] font-medium leading-[18px]">Ghi chú</span><MTextarea v-model="draft.note" :rows="3" maxlength="1000" :disabled="saving" /></label><p v-if="serverError" role="alert" class="rounded-lg bg-[var(--mds-danger-bg)] px-3 py-2 text-[13px] leading-[18px] text-[var(--mds-danger)]">{{ serverError }}</p></div></div><footer class="shrink-0 border-t border-[var(--mds-border-light)] bg-[var(--mds-bg)] px-4 pb-[calc(12px+var(--mds-mobile-safe-bottom))] pt-3"><MButton variant="primary" class="w-full" :loading="saving" :disabled="saving" @click="submit">Lưu thay đổi</MButton></footer></form><MDialog v-model="confirmDiscard" title="Bỏ thay đổi?" type="danger" confirm-text="Bỏ thay đổi" @confirm="emit('cancel')"><p>Các thay đổi chưa lưu sẽ không được giữ lại.</p></MDialog></section>
</template>
