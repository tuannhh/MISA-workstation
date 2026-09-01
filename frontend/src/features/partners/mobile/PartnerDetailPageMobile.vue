<script setup>
import { ref } from 'vue';
import MButton from '../../../components/mds/MButton.vue';
import MDialog from '../../../components/mds/MDialog.vue';
import MEmptyState from '../../../components/mds/MEmptyState.vue';
import MMobileTopBar from '../../../components/mds/MMobileTopBar.vue';
import MTag from '../../../components/mds/MTag.vue';
import MTabs from '../../../components/mds/MTabs.vue';

defineProps({ detail: { type: Object, required: true }, safeAreaStyle: { type: Object, default: () => ({}) }, canEdit: { type: Boolean, default: false }, canDelete: { type: Boolean, default: false }, deleteWorking: { type: Boolean, default: false }, deleteError: { type: String, default: '' } });
const emit = defineEmits(['back', 'navigate', 'edit', 'delete-partner']);
const activeTab = ref('overview');
const deleteOpen = ref(false);
const tabs = [{ key: 'overview', label: 'Thông tin' }, { key: 'people', label: 'Nhân sự' }, { key: 'dates', label: 'Nhắc lịch' }];
</script>

<template>
  <section class="mds-mobile-app flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-[var(--mds-bg)] text-[var(--mds-text)]" :style="safeAreaStyle">
    <MMobileTopBar :title="detail.name" @back="emit('back')"><template v-if="canEdit" #actions><MButton variant="link" @click="emit('edit')">Sửa</MButton></template></MMobileTopBar>
    <div class="mds-mobile-gutter-x shrink-0 border-b border-[var(--mds-border-light)] py-3"><p class="truncate text-[14px] font-medium leading-5">{{ detail.subtitle }}</p><MTag color="brand" class="mt-1">{{ detail.typeLabel }}</MTag></div>
    <MTabs v-model="activeTab" :tabs="tabs" class="flex min-h-0 flex-1 flex-col [&>[role=tablist]]:shrink-0 [&>[role=tablist]]:overflow-x-auto [&>[role=tablist]]:whitespace-nowrap [&>[role=tablist]]:px-4 [&>[role=tabpanel]]:min-h-0 [&>[role=tabpanel]]:flex-1 [&>[role=tabpanel]]:overflow-y-auto">
      <div v-if="activeTab === 'overview'"><dl class="mds-mobile-gutter-x pb-4"><div v-for="field in detail.fields" :key="field[0]" class="mds-mobile-row-gap-4 flex min-h-[var(--mds-mobile-touch-target)] items-center gap-4 border-b border-[var(--mds-border-light)] py-2"><dt class="w-[132px] shrink-0 text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">{{ field[0] }}</dt><dd class="mds-mobile-readable min-w-0 flex-1 break-words text-right text-[13px] font-medium leading-[18px]">{{ field[1] }}</dd></div></dl><div v-if="canDelete" class="mds-mobile-gutter-x pb-6"><p v-if="deleteError" role="alert" class="mb-3 rounded-lg bg-[var(--mds-danger-bg)] px-3 py-2 text-[13px] leading-[18px] text-[var(--mds-danger)]">{{ deleteError }}</p><MButton variant="danger" class="w-full" :disabled="deleteWorking" @click="deleteOpen = true">Xóa cơ quan</MButton></div></div>
      <section v-else-if="activeTab === 'people'" class="px-4 pb-5"><div v-if="detail.people.length" class="divide-y divide-[var(--mds-border-light)]"><MButton v-for="person in detail.people" :key="person.id" variant="link" class="flex min-h-[64px] h-auto w-full items-center justify-between gap-4 rounded-none py-2 text-left" @click="emit('navigate', person.id)"><span class="min-w-0"><strong class="block truncate text-[14px]">{{ person.name }}</strong><span class="mt-1 block truncate text-[13px] text-[var(--mds-text-secondary)]">{{ person.role }}</span></span><span class="shrink-0 text-[var(--mds-brand-600)]" aria-hidden="true">›</span></MButton></div><MEmptyState v-else title="Chưa có nhân sự" description="Nhân sự được tạo trong luồng quản lý danh bạ." /></section>
      <section v-else class="px-4 pb-5"><div v-if="detail.dates.length" class="divide-y divide-[var(--mds-border-light)]"><div v-for="date in detail.dates" :key="date.id" class="flex min-h-[64px] items-center justify-between gap-4 py-2"><span class="min-w-0"><strong class="block truncate text-[14px]">{{ date.title }}</strong><span v-if="date.recurring" class="mt-1 block text-[13px] text-[var(--mds-text-secondary)]">Lặp lại hằng năm</span></span><span class="shrink-0 text-[13px] font-medium">{{ date.date }}</span></div></div><MEmptyState v-else title="Chưa có ngày nhắc" description="Ngày thành lập và các mốc hợp tác sẽ xuất hiện tại đây khi được tạo." /></section>
    </MTabs>
    <MDialog v-model="deleteOpen" title="Xóa cơ quan?" type="danger" confirm-text="Xóa cơ quan" @confirm="emit('delete-partner')"><p>Hồ sơ cơ quan và các dữ liệu liên quan có thể bị xóa. Thao tác này không thể hoàn tác.</p></MDialog>
  </section>
</template>
