<script setup>
import MButton from '../../../components/mds/MButton.vue';
import MEmptyState from '../../../components/mds/MEmptyState.vue';

const props = defineProps({ detail: { type: Object, required: true }, canCreate: Boolean, canEdit: { type: Function, default: () => false }, canDelete: Boolean, canReassign: { type: Function, default: () => false } });
const emit = defineEmits(['create', 'edit', 'delete', 'reassign']);
const groups = [
  { entity: 'sponsorship', title: 'Tài trợ / giải thưởng', key: 'sponsorships' },
  { entity: 'gift', title: 'Quà tặng đối ngoại', key: 'gifts' },
  { entity: 'association_fee', title: 'Hội phí', key: 'associationFees' },
  { entity: 'benefit_usage', title: 'Quyền lợi hợp đồng', key: 'benefitUsages' },
];
</script>

<template><section class="grid gap-4 lg:grid-cols-2"><article v-for="group in groups" :key="group.entity" class="rounded-lg bg-[var(--mds-bg)] p-5 shadow-[var(--mds-shadow-card)]"><header class="flex items-center justify-between gap-3"><h2 class="text-[16px] font-semibold">{{ group.title }}</h2><MButton v-if="canCreate" variant="secondary" @click="emit('create', group.entity)">Thêm</MButton></header><div v-if="detail[group.key]?.length" class="mt-3 divide-y divide-[var(--mds-border-light)]"><div v-for="record in detail[group.key]" :key="record.id" class="flex min-h-14 items-center justify-between gap-3 py-2"><span class="min-w-0"><strong class="block truncate text-[13px]">{{ record.title }}</strong><span class="mt-1 block truncate text-[12px] text-[var(--mds-text-secondary)]">{{ record.subtitle }}</span></span><span class="flex shrink-0 items-center gap-2"><MButton v-if="canEdit(record)" variant="link" @click="emit('edit', { entity: group.entity, record })">Sửa</MButton><MButton v-if="canReassign(record)" variant="link" @click="emit('reassign', { entity: group.entity, record })">Gán</MButton><MButton v-if="canDelete" variant="link" class="text-[var(--mds-danger)]" @click="emit('delete', { entity: group.entity, record })">Xóa</MButton></span></div></div><MEmptyState v-else class="mt-3" :title="`Chưa có ${group.title.toLowerCase()}`" description="Bản ghi được phép xem sẽ xuất hiện tại đây."/></article></section></template>
