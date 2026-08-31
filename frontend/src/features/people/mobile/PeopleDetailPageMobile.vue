<script setup>
import { ref } from 'vue';
import MEmptyState from '../../../components/mds/MEmptyState.vue';
import MMobileTopBar from '../../../components/mds/MMobileTopBar.vue';
import MTag from '../../../components/mds/MTag.vue';
import MTabs from '../../../components/mds/MTabs.vue';
import { fileUrl } from '../domain/people-detail.mjs';

defineProps({ detail: { type: Object, required: true }, safeAreaStyle: { type: Object, default: () => ({}) } });
const emit = defineEmits(['back']);
const activeTab = ref('overview');
const tabs = [{ key: 'overview', label: 'Thông tin' }, { key: 'attachments', label: 'Tệp' }, { key: 'history', label: 'Tương tác' }];
</script>

<template>
  <section class="mds-mobile-app flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-[var(--mds-bg)] text-[var(--mds-text)]" :style="safeAreaStyle">
    <MMobileTopBar :title="detail.name" @back="emit('back')" />
    <div class="mds-mobile-gutter-x shrink-0 border-b border-[var(--mds-border-light)] py-4"><div class="flex min-w-0 items-center gap-3"><div class="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--mds-brand-50)] text-[18px] font-semibold text-[var(--mds-brand-700)]"><img v-if="fileUrl(detail.primaryPortrait?.id)" class="h-full w-full object-cover" :src="fileUrl(detail.primaryPortrait.id)" :alt="`Ảnh của ${detail.name}`" /><span v-else>{{ detail.initials }}</span></div><div class="min-w-0 flex-1"><p class="truncate text-[14px] font-medium leading-5">{{ detail.subtitle }}</p><MTag :color="detail.statusColor" class="mt-1">{{ detail.status }}</MTag></div></div></div>
    <MTabs v-model="activeTab" :tabs="tabs" class="flex min-h-0 flex-1 flex-col [&>[role=tablist]]:shrink-0 [&>[role=tablist]]:overflow-x-auto [&>[role=tablist]]:whitespace-nowrap [&>[role=tablist]]:px-4 [&>[role=tabpanel]]:min-h-0 [&>[role=tabpanel]]:flex-1 [&>[role=tabpanel]]:overflow-y-auto">
      <dl v-if="activeTab === 'overview'" class="mds-mobile-gutter-x pb-4"><div v-for="field in detail.publicFields" :key="field[0]" class="mds-mobile-row-gap-4 flex min-h-[var(--mds-mobile-touch-target)] items-center gap-4 border-b border-[var(--mds-border-light)] py-2"><dt class="w-[116px] shrink-0 text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">{{ field[0] }}</dt><dd class="mds-mobile-readable min-w-0 flex-1 break-words text-right text-[13px] font-medium leading-[18px]">{{ field[1] }}</dd></div></dl>
      <MEmptyState v-else-if="activeTab === 'attachments'" title="Tệp đính kèm theo quyền" description="Khi host/route đã sẵn sàng, tệp chỉ hiện theo projection của máy chủ." />
      <MEmptyState v-else title="Chưa có tương tác được hiển thị" description="Luồng tương tác sẽ được chuyển trong slice tiếp theo." />
    </MTabs>
  </section>
</template>

<style scoped>
:deep([role='tablist']) { scrollbar-width: none; }
:deep([role='tablist']::-webkit-scrollbar) { display: none; }
</style>
