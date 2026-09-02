<script setup>
import { reactive } from 'vue';
import MButton from '../../../components/mds/MButton.vue';
import MEmptyState from '../../../components/mds/MEmptyState.vue';
import MInput from '../../../components/mds/MInput.vue';
import MTextarea from '../../../components/mds/MTextarea.vue';
import { budgetPayload } from '../domain/budget-write.mjs';

const props = defineProps({ rows: { type: Array, default: () => [] }, canManage: Boolean, saving: Boolean, error: String });
const emit = defineEmits(['save']);
const draft = reactive({ period: new Date().toISOString().slice(0, 7), amount: '', note: '' });
function money(amount) { return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(amount || 0)); }
function useRow(row) { if (!props.canManage || !row?.amountVisible) return; Object.assign(draft, { period: row.period, amount: String(row.amount), note: row.note || '' }); }
function submit() { try { emit('save', budgetPayload(draft)); } catch (error) { emit('save-error', error.message); } }
</script>
<template>
  <section class="min-h-0 bg-[var(--mds-bg-page)] p-4"><div class="mx-auto max-w-[1200px] space-y-4">
    <header class="rounded-lg bg-[var(--mds-bg)] px-5 py-4 shadow-[var(--mds-shadow-card)]"><h2 class="text-[16px] font-semibold">Ngân sách theo kỳ</h2><p class="mt-1 text-[13px] text-[var(--mds-text-secondary)]">Số tiền là dữ liệu Confidential. Chỉ máy chủ quyết định ai được xem hoặc cập nhật.</p></header>
    <form v-if="canManage" class="rounded-lg bg-[var(--mds-bg)] p-5 shadow-[var(--mds-shadow-card)]" @submit.prevent="submit"><div class="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)_minmax(220px,1.4fr)_auto]"><label><span class="mb-1 block text-[13px] font-medium">Kỳ *</span><MInput v-model="draft.period" type="month" required /></label><label><span class="mb-1 block text-[13px] font-medium">Ngân sách (VND) *</span><MInput v-model="draft.amount" type="number" inputmode="decimal" required /></label><label><span class="mb-1 block text-[13px] font-medium">Ghi chú</span><MTextarea v-model="draft.note" :rows="1" /></label><div class="flex items-end"><MButton type="submit" variant="primary" :loading="saving">Lưu ngân sách</MButton></div></div><p v-if="error" role="alert" class="mt-3 text-[13px] text-[var(--mds-danger)]">{{ error }}</p></form>
    <section class="overflow-hidden rounded-lg bg-[var(--mds-bg)] shadow-[var(--mds-shadow-card)]"><header class="border-b border-[var(--mds-border-light)] px-5 py-3"><h3 class="text-[15px] font-semibold">Các kỳ đã khai báo</h3></header><MEmptyState v-if="!rows.length" title="Chưa có ngân sách" description="Kỳ ngân sách được phép xem sẽ xuất hiện tại đây."/><div v-else class="overflow-x-auto"><table class="w-full text-left text-[13px]"><thead class="bg-[var(--mds-bg-page)] text-[12px] text-[var(--mds-text-secondary)]"><tr><th class="px-5 py-3">Kỳ</th><th class="px-3 py-3 text-right">Ngân sách</th><th class="px-3 py-3">Ghi chú</th><th v-if="canManage" class="px-5 py-3 text-right">Thao tác</th></tr></thead><tbody class="divide-y divide-[var(--mds-border-light)]"><tr v-for="row in rows" :key="row.period"><td class="px-5 py-3 font-medium">{{ row.period }}</td><td class="px-3 py-3 text-right tabular-nums">{{ row.amountVisible ? money(row.amount) : 'Đã ẩn theo quyền' }}</td><td class="px-3 py-3 text-[var(--mds-text-secondary)]">{{ row.note || '—' }}</td><td v-if="canManage" class="px-5 py-3 text-right"><MButton v-if="row.amountVisible" variant="link" @click="useRow(row)">Sửa</MButton></td></tr></tbody></table></div></section>
  </div></section>
</template>
