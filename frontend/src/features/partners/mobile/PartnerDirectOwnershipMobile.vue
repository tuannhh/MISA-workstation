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

<template><section class="space-y-5"><article v-for="group in groups" :key="group.entity"><header class="flex items-center justify-between gap-3"><h2 class="text-[16px] font-semibold">{{ group.title }}</h2><MButton v-if="canCreate" variant="link" class="[&]:h-[var(--mds-mobile-touch-target)]" @click="emit('create', group.entity)">Thêm</MButton></header><div v-if="detail[group.key]?.length" class="mt-2 divide-y divide-[var(--mds-border-light)]"><div v-for="record in detail[group.key]" :key="record.id" class="py-2"><div class="flex min-h-[48px] items-center justify-between gap-3"><span class="min-w-0"><strong class="block truncate text-[14px]">{{ record.title }}</strong><span class="mt-1 block truncate text-[13px] text-[var(--mds-text-secondary)]">{{ record.subtitle }}</span></span></div><div v-if="canEdit(record)||canReassign(record)||canDelete" class="flex justify-end gap-2"><MButton v-if="canEdit(record)" variant="link" class="[&]:h-[var(--mds-mobile-touch-target)]" @click="emit('edit', { entity: group.entity, record })">Sửa</MButton><MButton v-if="canReassign(record)" variant="link" class="[&]:h-[var(--mds-mobile-touch-target)]" @click="emit('reassign', { entity: group.entity, record })">Gán</MButton><MButton v-if="canDelete" variant="link" class="[&]:h-[var(--mds-mobile-touch-target)] text-[var(--mds-danger)]" @click="emit('delete', { entity: group.entity, record })">Xóa</MButton></div></div></div><MEmptyState v-else class="mt-2" :title="`Chưa có ${group.title.toLowerCase()}`" description="Bản ghi được phép xem sẽ xuất hiện tại đây."/></article></section></template>
