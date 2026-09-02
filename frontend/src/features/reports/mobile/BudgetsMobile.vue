<script setup>
import { reactive } from 'vue';
import MButton from '../../../components/mds/MButton.vue';
import MEmptyState from '../../../components/mds/MEmptyState.vue';
import MInput from '../../../components/mds/MInput.vue';
import MMobileTopBar from '../../../components/mds/MMobileTopBar.vue';
import MTextarea from '../../../components/mds/MTextarea.vue';
import { budgetPayload } from '../domain/budget-write.mjs';

const props = defineProps({ rows: { type: Array, default: () => [] }, canManage: Boolean, saving: Boolean, error: String, safeAreaStyle: Object });
const emit = defineEmits(['back', 'save']);
const draft = reactive({ period: new Date().toISOString().slice(0, 7), amount: '', note: '' });
function money(amount) { return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(amount || 0)); }
function useRow(row) { if (!props.canManage || !row?.amountVisible) return; Object.assign(draft, { period: row.period, amount: String(row.amount), note: row.note || '' }); }
function submit() { try { emit('save', budgetPayload(draft)); } catch (error) { emit('save-error', error.message); } }
</script>
<template>
  <section class="mds-mobile-app flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-[var(--mds-bg)]" :style="safeAreaStyle"><MMobileTopBar title="Ngân sách" @back="emit('back')"/><main class="min-h-0 flex-1 overflow-y-auto pb-[var(--mds-mobile-safe-bottom)]"><div class="mds-mobile-gutter-x space-y-4 py-4"><p class="text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">Số tiền chỉ xuất hiện khi PolicyEngine cho phép. Quyền cuối cùng luôn được kiểm tra lại khi lưu.</p><form v-if="canManage" class="space-y-3 rounded-lg bg-[var(--mds-bg-page)] p-4" @submit.prevent="submit"><label><span class="mb-1 block text-[13px] font-medium">Kỳ *</span><MInput v-model="draft.period" type="month" required /></label><label><span class="mb-1 block text-[13px] font-medium">Ngân sách (VND) *</span><MInput v-model="draft.amount" type="number" inputmode="decimal" required /></label><label><span class="mb-1 block text-[13px] font-medium">Ghi chú</span><MTextarea v-model="draft.note" :rows="2" /></label><p v-if="error" role="alert" class="text-[13px] text-[var(--mds-danger)]">{{ error }}</p><MButton type="submit" variant="primary" class="w-full" :loading="saving">Lưu ngân sách</MButton></form><MEmptyState v-if="!rows.length" title="Chưa có ngân sách" description="Kỳ ngân sách được phép xem sẽ xuất hiện tại đây."/><div v-else class="divide-y divide-[var(--mds-border-light)]"><article v-for="row in rows" :key="row.period" class="py-3"><div class="flex items-start justify-between gap-3"><div><strong class="text-[14px]">{{ row.period }}</strong><p class="mt-1 text-[13px] text-[var(--mds-text-secondary)]">{{ row.note || 'Không có ghi chú' }}</p></div><strong class="text-right text-[13px] tabular-nums">{{ row.amountVisible ? money(row.amount) : 'Đã ẩn theo quyền' }}</strong></div><div v-if="canManage&&row.amountVisible" class="mt-2 flex justify-end"><MButton variant="link" class="[&]:h-[var(--mds-mobile-touch-target)]" @click="useRow(row)">Sửa kỳ này</MButton></div></article></div></div></main></section>
</template>
