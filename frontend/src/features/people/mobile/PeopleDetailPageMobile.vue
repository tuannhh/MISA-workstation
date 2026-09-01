<script setup>
import { ref } from 'vue';
import MButton from '../../../components/mds/MButton.vue';
import MDialog from '../../../components/mds/MDialog.vue';
import MEmptyState from '../../../components/mds/MEmptyState.vue';
import MMobileTopBar from '../../../components/mds/MMobileTopBar.vue';
import MTag from '../../../components/mds/MTag.vue';
import MTabs from '../../../components/mds/MTabs.vue';
import PeopleAttachmentsPanel from '../PeopleAttachmentsPanel.vue';
import PeopleBookingsPanel from '../PeopleBookingsPanel.vue';
import { fileUrl } from '../domain/people-detail.mjs';

defineProps({ detail: { type: Object, required: true }, bookings: { type: Array, default: () => [] }, bookingTotal: { type: [String, Number], default: null }, bookingError: { type: String, default: '' }, safeAreaStyle: { type: Object, default: () => ({}) }, canEdit: { type: Boolean, default: false }, canDelete: { type: Boolean, default: false }, deleteWorking: { type: Boolean, default: false }, deleteError: { type: String, default: '' }, canManageIdDocs: { type: Boolean, default: false }, attachmentWorking: { type: Boolean, default: false }, attachmentError: { type: String, default: '' } });
const emit = defineEmits(['back', 'edit', 'delete-person', 'upload', 'set-primary', 'delete-attachment']);
const activeTab = ref('overview');
const deleteOpen = ref(false);
const tabs = [{ key: 'overview', label: 'Thông tin' }, { key: 'attachments', label: 'Tệp' }, { key: 'bookings', label: 'Booking' }, { key: 'history', label: 'Tương tác' }];
</script>

<template>
  <section class="mds-mobile-app flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-[var(--mds-bg)] text-[var(--mds-text)]" :style="safeAreaStyle">
    <MMobileTopBar :title="detail.name" @back="emit('back')"><template v-if="canEdit" #actions><MButton variant="link" @click="emit('edit')">Sửa</MButton></template></MMobileTopBar>
    <div class="mds-mobile-gutter-x shrink-0 border-b border-[var(--mds-border-light)] py-4"><div class="flex min-w-0 items-center gap-3"><div class="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--mds-brand-50)] text-[18px] font-semibold text-[var(--mds-brand-700)]"><img v-if="fileUrl(detail.primaryPortrait?.id)" class="h-full w-full object-cover" :src="fileUrl(detail.primaryPortrait.id)" :alt="`Ảnh của ${detail.name}`" /><span v-else>{{ detail.initials }}</span></div><div class="min-w-0 flex-1"><p class="truncate text-[14px] font-medium leading-5">{{ detail.subtitle }}</p><MTag :color="detail.statusColor" class="mt-1">{{ detail.status }}</MTag></div></div></div>
    <MTabs v-model="activeTab" :tabs="tabs" class="flex min-h-0 flex-1 flex-col [&>[role=tablist]]:shrink-0 [&>[role=tablist]]:overflow-x-auto [&>[role=tablist]]:whitespace-nowrap [&>[role=tablist]]:px-4 [&>[role=tabpanel]]:min-h-0 [&>[role=tabpanel]]:flex-1 [&>[role=tabpanel]]:overflow-y-auto">
      <div v-if="activeTab === 'overview'"><dl class="mds-mobile-gutter-x pb-4"><div v-for="field in detail.publicFields" :key="field[0]" class="mds-mobile-row-gap-4 flex min-h-[var(--mds-mobile-touch-target)] items-center gap-4 border-b border-[var(--mds-border-light)] py-2"><dt class="w-[116px] shrink-0 text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">{{ field[0] }}</dt><dd class="mds-mobile-readable min-w-0 flex-1 break-words text-right text-[13px] font-medium leading-[18px]">{{ field[1] }}</dd></div></dl><div v-if="canDelete" class="mds-mobile-gutter-x pb-6"><p v-if="deleteError" role="alert" class="mb-3 rounded-lg bg-[var(--mds-danger-bg)] px-3 py-2 text-[13px] leading-[18px] text-[var(--mds-danger)]">{{ deleteError }}</p><MButton variant="danger" class="w-full" :disabled="deleteWorking" @click="deleteOpen = true">Xóa hồ sơ</MButton></div></div>
      <PeopleAttachmentsPanel v-else-if="activeTab === 'attachments'" :portraits="detail.portraits" :id-docs="detail.idDocs" :id-doc-count="detail.idDocCount" :can-edit="canEdit" :can-manage-id-docs="canManageIdDocs" :working="attachmentWorking" :error="attachmentError" @upload="emit('upload', $event)" @set-primary="emit('set-primary', $event)" @delete="emit('delete-attachment', $event)" />
      <PeopleBookingsPanel v-else-if="activeTab === 'bookings'" class="mds-mobile-gutter-x py-4" :bookings="bookings" :total-amount="bookingTotal" :error="bookingError" />
      <MEmptyState v-else title="Chưa có tương tác được hiển thị" description="Luồng tương tác sẽ được chuyển trong slice tiếp theo." />
    </MTabs>
    <MDialog v-model="deleteOpen" title="Xóa hồ sơ nhân sự?" type="danger" confirm-text="Xóa hồ sơ" @confirm="emit('delete-person')"><p>Hồ sơ và các tệp đính kèm sẽ bị xóa. Thao tác này không thể hoàn tác.</p></MDialog>
  </section>
</template>

<style scoped>
:deep([role='tablist']) { scrollbar-width: none; }
:deep([role='tablist']::-webkit-scrollbar) { display: none; }
</style>
