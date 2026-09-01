<script setup>
import { ref } from 'vue';
import MButton from '../../../components/mds/MButton.vue';
import MEmptyState from '../../../components/mds/MEmptyState.vue';
import MMobileTopBar from '../../../components/mds/MMobileTopBar.vue';
import MTabs from '../../../components/mds/MTabs.vue';
import SupplierFilesPanel from '../SupplierFilesPanel.vue';
defineProps({ detail: { type: Object, required: true }, safeAreaStyle: { type: Object, default: () => ({}) }, canEdit: { type: Boolean, default: false }, canUploadFiles: { type: Boolean, default: false }, canOpenFiles: { type: Boolean, default: false }, uploading: { type: Boolean, default: false }, fileError: { type: String, default: '' } });
const emit = defineEmits(['back', 'edit', 'upload-files']);
const activeTab = ref('overview');
const tabs = [{ key: 'overview', label: 'Thông tin' }, { key: 'files', label: 'Tệp' }];
</script>

<template>
  <section class="mds-mobile-app flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-[var(--mds-bg)] text-[var(--mds-text)]" :style="safeAreaStyle"><MMobileTopBar :title="detail.name" @back="emit('back')"><template v-if="canEdit" #actions><MButton variant="link" @click="emit('edit')">Sửa</MButton></template></MMobileTopBar><div class="mds-mobile-gutter-x shrink-0 border-b border-[var(--mds-border-light)] py-4"><p class="text-[14px] font-medium leading-5">{{ detail.subtitle }}</p><p class="mt-1 text-[12px] leading-4 text-[var(--mds-text-secondary)]">Hồ sơ nhà cung cấp</p></div><MTabs v-model="activeTab" :tabs="tabs" class="flex min-h-0 flex-1 flex-col [&>[role=tablist]]:shrink-0 [&>[role=tablist]]:px-4 [&>[role=tabpanel]]:min-h-0 [&>[role=tabpanel]]:flex-1 [&>[role=tabpanel]]:overflow-y-auto"><div v-if="activeTab === 'overview'"><dl v-if="detail.fields.length" class="mds-mobile-gutter-x pb-4"><div v-for="field in detail.fields" :key="field[0]" class="mds-mobile-row-gap-4 flex min-h-[var(--mds-mobile-touch-target)] items-center gap-4 border-b border-[var(--mds-border-light)] py-2"><dt class="w-[124px] shrink-0 text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">{{ field[0] }}</dt><dd class="mds-mobile-readable min-w-0 flex-1 break-words text-right text-[13px] font-medium leading-[18px]">{{ field[1] }}</dd></div></dl><MEmptyState v-else title="Chưa có thông tin để hiển thị" description="Hồ sơ chưa có trường nào được phép xem." /><div class="mds-mobile-gutter-x pb-6"><MButton variant="neutral" class="w-full" @click="emit('back')">Quay lại danh sách</MButton></div></div><SupplierFilesPanel v-else class="mds-mobile-gutter-x py-4" :files="detail.files" :can-upload="canUploadFiles" :can-open="canOpenFiles" :uploading="uploading" :error="fileError" @upload="emit('upload-files', $event)" /></MTabs></section>
</template>
