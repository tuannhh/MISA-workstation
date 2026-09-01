<script setup>
import { ref } from 'vue';
import MButton from '../../../components/mds/MButton.vue';
import MDialog from '../../../components/mds/MDialog.vue';
import MEmptyState from '../../../components/mds/MEmptyState.vue';
import MTag from '../../../components/mds/MTag.vue';
import MTabs from '../../../components/mds/MTabs.vue';
import PeopleAttachmentsPanel from '../PeopleAttachmentsPanel.vue';
import PeopleBookingsPanel from '../PeopleBookingsPanel.vue';
import { fileUrl } from '../domain/people-detail.mjs';

defineProps({ detail: { type: Object, required: true }, bookings: { type: Array, default: () => [] }, bookingTotal: { type: [String, Number], default: null }, bookingError: { type: String, default: '' }, bookingDeletingId: { type: Number, default: null }, bookingDeleteError: { type: String, default: '' }, canCreateBookings: { type: Boolean, default: false }, canEditBooking: { type: Function, default: () => false }, canEdit: { type: Boolean, default: false }, canDelete: { type: Boolean, default: false }, deleteWorking: { type: Boolean, default: false }, deleteError: { type: String, default: '' }, canManageIdDocs: { type: Boolean, default: false }, attachmentWorking: { type: Boolean, default: false }, attachmentError: { type: String, default: '' } });
const emit = defineEmits(['back', 'edit', 'create-booking', 'edit-booking', 'delete-booking', 'delete-person', 'upload', 'set-primary', 'delete-attachment']);
const activeTab = ref('overview');
const deleteOpen = ref(false);
const tabs = [{ key: 'overview', label: 'Thông tin chung' }, { key: 'attachments', label: 'Tệp đính kèm' }, { key: 'bookings', label: 'Booking' }, { key: 'history', label: 'Tương tác' }];
</script>

<template>
  <section class="min-h-0 bg-[var(--mds-bg-page)] p-4">
    <header class="mb-4 flex min-w-0 items-center justify-between gap-4 rounded-lg bg-[var(--mds-bg)] px-4 py-3 shadow-[var(--mds-shadow-card)]">
      <div class="flex min-w-0 items-center gap-3">
        <div class="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--mds-brand-50)] text-[16px] font-semibold text-[var(--mds-brand-700)]">
          <img v-if="fileUrl(detail.primaryPortrait?.id)" class="h-full w-full object-cover" :src="fileUrl(detail.primaryPortrait.id)" :alt="`Ảnh của ${detail.name}`" />
          <span v-else>{{ detail.initials }}</span>
        </div>
        <div class="min-w-0"><h1 class="truncate text-[20px] font-semibold leading-7 text-[var(--mds-text)]">{{ detail.name }}</h1><p class="truncate text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">{{ detail.subtitle }}</p></div>
        <MTag :color="detail.statusColor" class="hidden lg:inline-flex">{{ detail.status }}</MTag>
      </div>
      <div class="flex shrink-0 items-center gap-2"><MButton variant="neutral" @click="emit('back')">Danh bạ</MButton><MButton v-if="canDelete" variant="danger" :disabled="deleteWorking" @click="deleteOpen = true">Xóa</MButton><MButton v-if="canEdit" variant="primary" @click="emit('edit')">Chỉnh sửa</MButton></div>
    </header>
    <div class="rounded-lg bg-[var(--mds-bg)] shadow-[var(--mds-shadow-card)]">
      <MTabs v-model="activeTab" :tabs="tabs" class="[&>[role=tablist]]:px-4">
        <div v-if="activeTab === 'overview'" class="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section class="min-w-0"><h2 class="text-[16px] font-semibold leading-[22px]">Thông tin công khai</h2><dl class="mt-3 grid gap-x-8 sm:grid-cols-2"><div v-for="field in detail.publicFields" :key="field[0]" class="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-b border-[var(--mds-border-light)] py-2.5"><dt class="text-[12px] leading-4 text-[var(--mds-text-secondary)]">{{ field[0] }}</dt><dd class="min-w-0 break-words text-[13px] font-medium leading-[18px] text-[var(--mds-text)]">{{ field[1] }}</dd></div></dl></section>
          <aside class="rounded-lg bg-[var(--mds-bg-page)] p-4"><h2 class="text-[14px] font-semibold leading-5">Dữ liệu được phép xem</h2><p class="mt-2 text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">Thông tin nhạy cảm và giấy tờ chỉ hiển thị khi API đã chiếu dữ liệu theo PolicyEngine.</p><dl class="mt-4 space-y-3 text-[13px]"><div class="flex justify-between gap-3"><dt class="text-[var(--mds-text-secondary)]">Ảnh chân dung</dt><dd class="font-medium">{{ detail.portraitCount }}</dd></div><div class="flex justify-between gap-3"><dt class="text-[var(--mds-text-secondary)]">Giấy tờ đã ẩn/hiện</dt><dd class="font-medium">{{ detail.idDocCount }}</dd></div></dl></aside>
        </div>
        <PeopleAttachmentsPanel v-else-if="activeTab === 'attachments'" :portraits="detail.portraits" :id-docs="detail.idDocs" :id-doc-count="detail.idDocCount" :can-edit="canEdit" :can-manage-id-docs="canManageIdDocs" :working="attachmentWorking" :error="attachmentError" @upload="emit('upload', $event)" @set-primary="emit('set-primary', $event)" @delete="emit('delete-attachment', $event)" />
        <PeopleBookingsPanel v-else-if="activeTab === 'bookings'" class="p-4" :bookings="bookings" :total-amount="bookingTotal" :error="bookingError" :deleting-id="bookingDeletingId" :delete-error="bookingDeleteError" :can-create="canCreateBookings" :can-edit="canEditBooking" :can-delete="canDelete" @create="emit('create-booking')" @edit="emit('edit-booking', $event)" @delete="emit('delete-booking', $event)" />
        <MEmptyState v-else title="Chưa có tương tác được hiển thị" description="Tương tác và biểu mẫu sẽ được chuyển trong slice People List/Forms/Interactions." />
      </MTabs>
    </div>
    <p v-if="deleteError" role="alert" class="mx-auto mt-3 max-w-[960px] rounded-lg bg-[var(--mds-danger-bg)] px-3 py-2 text-[13px] leading-[18px] text-[var(--mds-danger)]">{{ deleteError }}</p>
    <MDialog v-model="deleteOpen" title="Xóa hồ sơ nhân sự?" type="danger" confirm-text="Xóa hồ sơ" @confirm="emit('delete-person')"><p>Hồ sơ và các tệp đính kèm sẽ bị xóa. Thao tác này không thể hoàn tác.</p></MDialog>
  </section>
</template>
