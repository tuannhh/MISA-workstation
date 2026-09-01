<script setup>
import { ref } from 'vue';
import MButton from '../../../components/mds/MButton.vue';
import MDialog from '../../../components/mds/MDialog.vue';
import MTag from '../../../components/mds/MTag.vue';
import EventCostsPanel from '../EventCostsPanel.vue';
import EventFilesPanel from '../EventFilesPanel.vue';
defineProps({ detail: { type: Object, required: true }, canEdit: Boolean, canDelete: Boolean, canReassignOwner:Boolean, canManageCosts: Boolean, costDeleting: Boolean, costError: String, deleteWorking: Boolean, deleteError: String, uploading: Boolean, fileError: String });
const emit = defineEmits(['back', 'edit', 'delete', 'reassign-owner', 'upload', 'add-cost', 'edit-cost', 'delete-cost']); const deleteOpen = ref(false);
</script>

<template>
  <section class="min-h-0 bg-[var(--mds-bg-page)] p-4">
    <div class="mx-auto max-w-[1200px] space-y-4">
      <header class="flex min-h-14 items-start justify-between gap-4 rounded-lg bg-[var(--mds-bg)] px-5 py-4 shadow-[var(--mds-shadow-card)]">
        <div class="min-w-0"><p class="text-[13px] text-[var(--mds-text-secondary)]">Sự kiện</p><h1 class="truncate text-[20px] font-semibold">{{ detail.title }}</h1><p class="mt-1 text-[13px] text-[var(--mds-text-secondary)]">{{ detail.time }} · {{ detail.location }}</p></div>
        <div class="flex shrink-0 items-center gap-2"><MButton variant="neutral" @click="emit('back')">Quay lại</MButton><MButton v-if="canReassignOwner" variant="secondary" @click="emit('reassign-owner')">Gán phụ trách</MButton><MButton v-if="canDelete" variant="danger" :disabled="deleteWorking" @click="deleteOpen = true">Xóa</MButton><MButton v-if="canEdit" variant="primary" @click="emit('edit')">Sửa</MButton><MTag color="neutral">{{ detail.status }}</MTag></div>
      </header>
      <section class="rounded-lg bg-[var(--mds-bg)] p-5 shadow-[var(--mds-shadow-card)]"><h2 class="text-[16px] font-semibold">Thông tin chung</h2><dl class="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2"><div><dt class="text-[12px] text-[var(--mds-text-secondary)]">Đơn vị tổ chức</dt><dd class="mt-1 text-[13px]">{{ detail.organizer }}</dd></div><div><dt class="text-[12px] text-[var(--mds-text-secondary)]">Hình thức</dt><dd class="mt-1 text-[13px]">{{ detail.fields.mode }}</dd></div><div><dt class="text-[12px] text-[var(--mds-text-secondary)]">Lĩnh vực</dt><dd class="mt-1 text-[13px]">{{ detail.fields.field }}</dd></div><div><dt class="text-[12px] text-[var(--mds-text-secondary)]">Định dạng</dt><dd class="mt-1 text-[13px]">{{ detail.fields.format }}</dd></div><div><dt class="text-[12px] text-[var(--mds-text-secondary)]">Quy mô</dt><dd class="mt-1 text-[13px]">{{ detail.fields.scale_attendees }}</dd></div><div><dt class="text-[12px] text-[var(--mds-text-secondary)]">Cấp khách mời</dt><dd class="mt-1 text-[13px]">{{ detail.fields.guest_levels }}</dd></div></dl></section>
      <section class="rounded-lg bg-[var(--mds-bg)] p-5 shadow-[var(--mds-shadow-card)]"><h2 class="text-[16px] font-semibold">Chi phí theo quyền được cấp</h2><p class="mt-1 text-[13px] text-[var(--mds-text-secondary)]">Số liệu do máy chủ chiếu theo PolicyEngine; ứng dụng không tự tổng hợp ở trình duyệt.</p><dl class="mt-4 grid gap-3 sm:grid-cols-4"><div v-for="item in detail.costTotals" :key="item.label" class="rounded-lg bg-[var(--mds-bg-page)] p-3"><dt class="text-[12px] text-[var(--mds-text-secondary)]">{{ item.label }}</dt><dd class="mt-1 text-[16px] font-semibold">{{ item.value }}</dd></div></dl></section>
      <section class="rounded-lg bg-[var(--mds-bg)] p-5 shadow-[var(--mds-shadow-card)]"><EventCostsPanel :groups="detail.costGroups" :can-edit="canManageCosts" :can-delete="canDelete" :deleting="costDeleting" :error="costError" @add="emit('add-cost', $event)" @edit="emit('edit-cost', $event)" @delete="emit('delete-cost', $event)" /></section>
      <section class="rounded-lg bg-[var(--mds-bg)] p-5 shadow-[var(--mds-shadow-card)]"><EventFilesPanel :files="detail.files" :can-upload="canEdit" :uploading="uploading" :error="fileError" @upload="emit('upload', $event)" /></section>
      <section class="rounded-lg bg-[var(--mds-bg)] p-5 shadow-[var(--mds-shadow-card)]"><h2 class="text-[16px] font-semibold">Đánh giá & ghi chú</h2><dl class="mt-4 space-y-4"><div><dt class="text-[12px] text-[var(--mds-text-secondary)]">Đánh giá</dt><dd class="mt-1 whitespace-pre-wrap text-[13px]">{{ detail.fields.evaluation }}</dd></div><div><dt class="text-[12px] text-[var(--mds-text-secondary)]">Điểm nhấn MISA</dt><dd class="mt-1 whitespace-pre-wrap text-[13px]">{{ detail.fields.misa_keynotes }}</dd></div><div><dt class="text-[12px] text-[var(--mds-text-secondary)]">Ghi chú</dt><dd class="mt-1 whitespace-pre-wrap text-[13px]">{{ detail.fields.note }}</dd></div></dl></section>
      <p v-if="deleteError" role="alert" class="rounded-lg bg-[var(--mds-danger-bg)] px-3 py-2 text-[13px] text-[var(--mds-danger)]">{{ deleteError }}</p>
    </div>
    <MDialog v-model="deleteOpen" title="Xóa sự kiện?" type="danger" confirm-text="Xóa sự kiện" @confirm="emit('delete')"><p>Sự kiện và các tệp đính kèm liên quan sẽ bị xóa. Thao tác này không thể hoàn tác.</p></MDialog>
  </section>
</template>
