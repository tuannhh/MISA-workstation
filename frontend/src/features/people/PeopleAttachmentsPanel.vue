<script setup>
import { computed, ref } from 'vue';
import MButton from '../../components/mds/MButton.vue';
import MDialog from '../../components/mds/MDialog.vue';
import MEmptyState from '../../components/mds/MEmptyState.vue';
import MTag from '../../components/mds/MTag.vue';
import MUpload from '../../components/mds/MUpload.vue';
import { fileUrl } from './domain/people-detail.mjs';

const props = defineProps({ portraits: { type: Array, default: () => [] }, idDocs: { type: Array, default: () => [] }, idDocCount: { type: Number, default: 0 }, canEdit: { type: Boolean, default: false }, canManageIdDocs: { type: Boolean, default: false }, working: { type: Boolean, default: false }, error: { type: String, default: '' } });
const emit = defineEmits(['upload', 'set-primary', 'delete']);
const deleteTarget = ref(null);
const localError = ref('');
const visibleIdDocs = computed(() => props.idDocs || []);
const deleteOpen = computed({ get: () => Boolean(deleteTarget.value), set: (value) => { if (!value) deleteTarget.value = null; } });
function uploadPortrait(files) { localError.value = ''; emit('upload', { kind: 'portrait', visibility: 'public', files }); }
function uploadIdDocs(files) { localError.value = ''; emit('upload', { kind: 'id_doc', visibility: 'private', files }); }
function oversize(files) { localError.value = `${files.length} tệp vượt quá 5MB nên chưa được tải lên.`; }
function displayName(file) { return file?.original_name || `Tệp #${file?.id || ''}`; }
</script>

<template>
  <section class="space-y-5 p-4">
    <div><div class="mb-3 flex items-center justify-between gap-3"><div><h2 class="text-[16px] font-semibold leading-[22px]">Ảnh chân dung</h2><p class="mt-1 text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">Ảnh công khai tối đa 5 tệp; ảnh chính dùng trên hồ sơ.</p></div><MTag color="neutral">{{ portraits.length }}/5</MTag></div><div v-if="portraits.length" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><article v-for="file in portraits" :key="file.id" class="overflow-hidden rounded-lg border border-[var(--mds-border-light)]"><a :href="fileUrl(file.id)" target="_blank" rel="noopener" class="block aspect-[4/3] bg-[var(--mds-bg-page)]"><img class="h-full w-full object-cover" :src="fileUrl(file.id)" :alt="displayName(file)" /></a><div class="space-y-2 p-3"><p class="truncate text-[13px] font-medium">{{ displayName(file) }}</p><div class="flex items-center justify-between gap-2"><MTag :color="file.is_primary ? 'success' : 'neutral'">{{ file.is_primary ? 'Ảnh chính' : 'Ảnh phụ' }}</MTag><div v-if="canEdit" class="flex gap-1"><MButton v-if="!file.is_primary" variant="link" :disabled="working" @click="emit('set-primary', file.id)">Đặt chính</MButton><MButton variant="link" :disabled="working" @click="deleteTarget = file">Xóa</MButton></div></div></div></article></div><MEmptyState v-else title="Chưa có ảnh chân dung" description="Tải ảnh lên để nhận diện nhanh trong danh bạ." /></div>
    <MUpload v-if="canEdit" label="Tải ảnh chân dung" accept="image/jpeg,image/png,image/webp" :multiple="true" :disabled="working || portraits.length >= 5" @select-files="uploadPortrait" @oversized="oversize" />
    <div class="border-t border-[var(--mds-border-light)] pt-5"><div class="mb-3 flex items-center justify-between gap-3"><div><h2 class="text-[16px] font-semibold leading-[22px]">Giấy tờ tùy thân</h2><p class="mt-1 text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">Nội dung chỉ hiển thị khi máy chủ cấp quyền dữ liệu nhạy cảm.</p></div><MTag color="neutral">{{ idDocCount }} tệp</MTag></div><div v-if="visibleIdDocs.length" class="space-y-2"><article v-for="file in visibleIdDocs" :key="file.id" class="flex items-center justify-between gap-3 rounded-lg border border-[var(--mds-border-light)] px-3 py-2"><a :href="fileUrl(file.id)" target="_blank" rel="noopener" class="min-w-0 truncate text-[13px] font-medium text-[var(--mds-brand-700)] hover:underline">{{ displayName(file) }}</a><MButton v-if="canManageIdDocs" variant="link" :disabled="working" @click="deleteTarget = file">Xóa</MButton></article></div><MEmptyState v-else :title="idDocCount ? 'Tệp được bảo vệ' : 'Chưa có giấy tờ'" :description="idDocCount ? 'Bạn không có quyền mở nội dung giấy tờ này.' : 'Giấy tờ chỉ tải lên khi thật sự cần thiết.'" /></div>
    <MUpload v-if="canManageIdDocs" label="Tải giấy tờ tùy thân" accept="application/pdf,image/jpeg,image/png" :multiple="true" :disabled="working" @select-files="uploadIdDocs" @oversized="oversize" />
    <p v-if="localError || error" role="alert" class="rounded-lg bg-[var(--mds-danger-bg)] px-3 py-2 text-[13px] leading-[18px] text-[var(--mds-danger)]">{{ localError || error }}</p>
    <MDialog v-model="deleteOpen" title="Xóa tệp đính kèm?" type="danger" confirm-text="Xóa tệp" @confirm="emit('delete', deleteTarget?.id)"><p>Tệp sẽ bị xóa khỏi hồ sơ. Thao tác này không thể hoàn tác.</p></MDialog>
  </section>
</template>
