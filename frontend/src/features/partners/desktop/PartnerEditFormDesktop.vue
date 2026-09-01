<script setup>
import { nextTick, reactive, ref, watch } from 'vue';
import MButton from '../../../components/mds/MButton.vue';
import MInput from '../../../components/mds/MInput.vue';
import { toPartnerEditDraft, toPartnerUpdatePayload, validatePartnerEditDraft } from '../domain/partner-write.mjs';

const props = defineProps({ record: { type: Object, required: true }, saving: { type: Boolean, default: false }, serverError: { type: String, default: '' } });
const emit = defineEmits(['cancel', 'save']);
const draft = reactive({});
const errors = reactive({});
const nameInput = ref(null);
const fields = [['name', 'Tên cơ quan', 'Nhập tên cơ quan'], ['website', 'Website', 'https://example.vn'], ['address', 'Địa chỉ', 'Nhập địa chỉ']];
function resetDraft() { Object.assign(draft, toPartnerEditDraft(props.record)); Object.keys(errors).forEach((key) => delete errors[key]); }
watch(() => props.record, resetDraft, { immediate: true });
async function submit() { const nextErrors = validatePartnerEditDraft(draft); Object.keys(errors).forEach((key) => delete errors[key]); Object.assign(errors, nextErrors); if (Object.keys(nextErrors).length) { await nextTick(); nameInput.value?.focus(); return; } emit('save', toPartnerUpdatePayload(draft)); }
</script>

<template>
  <section class="min-h-0 bg-[var(--mds-bg-page)] p-4"><form class="mx-auto max-w-[800px] rounded-lg bg-[var(--mds-bg)] shadow-[var(--mds-shadow-card)]" novalidate @submit.prevent="submit"><header class="flex items-start justify-between gap-4 border-b border-[var(--mds-border-light)] px-5 py-4"><div><h1 class="text-[20px] font-semibold leading-7 text-[var(--mds-text)]">Chỉnh sửa cơ quan</h1><p class="mt-1 text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">Chỉ thông tin lõi công khai được gửi ở bước này. Máy chủ kiểm tra quyền lại khi lưu.</p></div><MButton variant="neutral" :disabled="saving" @click="emit('cancel')">Hủy</MButton></header><div class="grid gap-4 p-5 sm:grid-cols-2"><label v-for="[key, label, placeholder] in fields" :key="key" :class="['block', key === 'address' ? 'sm:col-span-2' : '']"><span class="mb-1.5 block text-[13px] font-medium leading-[18px] text-[var(--mds-text)]">{{ label }}<span v-if="key === 'name'" class="ml-1 text-[var(--mds-danger)]" aria-hidden="true">*</span></span><MInput :ref="key === 'name' ? nameInput : undefined" v-model="draft[key]" :type="key === 'website' ? 'url' : 'text'" :placeholder="placeholder" :error="errors[key]" :disabled="saving" /></label></div><p v-if="serverError" role="alert" class="mx-5 mb-4 rounded-lg bg-[var(--mds-danger-bg)] px-3 py-2 text-[13px] leading-[18px] text-[var(--mds-danger)]">{{ serverError }}</p><footer class="flex justify-end gap-2 border-t border-[var(--mds-border-light)] px-5 py-3"><MButton variant="neutral" :disabled="saving" @click="emit('cancel')">Hủy</MButton><MButton variant="primary" :loading="saving" :disabled="saving" @click="submit">Lưu thay đổi</MButton></footer></form></section>
</template>
