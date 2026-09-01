<script setup>
import MButton from '../../../components/mds/MButton.vue';
import MEmptyState from '../../../components/mds/MEmptyState.vue';
import MTag from '../../../components/mds/MTag.vue';

defineProps({ kind: { type: String, required: true }, rows: { type: Array, default: () => [] }, canReassign: { type: Function, default: () => false } });
const emit = defineEmits(['reassign']);
function money(value) { const number = Number(value); return Number.isFinite(number) ? `${new Intl.NumberFormat('vi-VN').format(number)} đ` : String(value ?? '—'); }
const copy = Object.freeze({ quote: Object.freeze({ title: 'Báo giá', empty: 'Chưa có dòng báo giá được phép xem.' }), transaction: Object.freeze({ title: 'Giao dịch', empty: 'Chưa có giao dịch được phép xem.' }), contact: Object.freeze({ title: 'Đầu mối', empty: 'Chưa có đầu mối nhà cung cấp.' }) });
</script>

<template>
  <section class="mds-mobile-gutter-x py-4"><h2 class="text-[16px] font-semibold leading-[22px]">{{ copy[kind].title }}</h2><p class="mt-1 text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">Dữ liệu hiển thị theo quyền hiện tại.</p><div v-if="rows.length" class="mt-3 divide-y divide-[var(--mds-border-light)]"><article v-for="row in rows" :key="row.id" class="flex min-h-[64px] items-center justify-between gap-3 py-2"><div class="min-w-0 flex-1"><template v-if="kind === 'quote'"><strong class="block truncate text-[14px]">{{ row.item }}</strong><p class="mt-1 truncate text-[13px] text-[var(--mds-text-secondary)]">{{ row.qty }} {{ row.unit }}<span v-if="row.hasUnitPrice"> · {{ money(row.unitPrice) }}</span></p></template><template v-else-if="kind === 'transaction'"><strong class="block truncate text-[14px]">{{ row.title }}</strong><p class="mt-1 truncate text-[13px] text-[var(--mds-text-secondary)]">{{ row.serviceType }} · {{ row.signedDate }}<span v-if="row.hasValue"> · {{ money(row.value) }}</span></p></template><template v-else><strong class="block truncate text-[14px]">{{ row.name }}</strong><p class="mt-1 truncate text-[13px] text-[var(--mds-text-secondary)]">{{ row.position }} · {{ row.phone }}</p></template></div><div class="flex shrink-0 items-center gap-2"><MTag v-if="kind === 'transaction'" color="neutral">{{ row.status }}</MTag><MTag v-else-if="kind === 'contact'" color="neutral">{{ row.role }}</MTag><MButton v-if="canReassign(row)" variant="link" class="[&]:h-[var(--mds-mobile-touch-target)]" @click="emit('reassign', row)">Gán</MButton></div></article></div><MEmptyState v-else :title="`Chưa có ${copy[kind].title.toLowerCase()}`" :description="copy[kind].empty" /></section>
</template>
