<script setup>
import MButton from '../../../components/mds/MButton.vue';
import MEmptyState from '../../../components/mds/MEmptyState.vue';

const props = defineProps({ detail: { type: Object, required: true }, canReassign: { type: Function, default: () => false } });
const emit = defineEmits(['reassign']);
const groups = [
  { entity: 'sponsorship', title: 'Tài trợ / giải thưởng', key: 'sponsorships' },
  { entity: 'gift', title: 'Quà tặng đối ngoại', key: 'gifts' },
  { entity: 'association_fee', title: 'Hội phí', key: 'associationFees' },
  { entity: 'benefit_usage', title: 'Quyền lợi hợp đồng', key: 'benefitUsages' },
];
</script>

<template><section class="space-y-5"><article v-for="group in groups" :key="group.entity"><h2 class="text-[16px] font-semibold">{{ group.title }}</h2><div v-if="detail[group.key]?.length" class="mt-2 divide-y divide-[var(--mds-border-light)]"><div v-for="record in detail[group.key]" :key="record.id" class="flex min-h-[64px] items-center justify-between gap-3 py-2"><span class="min-w-0"><strong class="block truncate text-[14px]">{{ record.title }}</strong><span class="mt-1 block truncate text-[13px] text-[var(--mds-text-secondary)]">{{ record.subtitle }}</span></span><MButton v-if="canReassign(record)" variant="link" class="shrink-0 [&]:h-[var(--mds-mobile-touch-target)]" @click="emit('reassign', { entity: group.entity, record })">Gán</MButton></div></div><MEmptyState v-else class="mt-2" :title="`Chưa có ${group.title.toLowerCase()}`" description="Bản ghi được phép xem sẽ xuất hiện tại đây."/></article></section></template>
