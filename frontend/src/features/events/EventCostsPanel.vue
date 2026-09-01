<script setup>
import { ref } from 'vue';
import MButton from '../../components/mds/MButton.vue';
import MDialog from '../../components/mds/MDialog.vue';
import MEmptyState from '../../components/mds/MEmptyState.vue';

defineProps({ groups: { type: Array, default: () => [] }, canEdit: Boolean, canDelete: Boolean, deleting: Boolean, error: String });
const emit = defineEmits(['add', 'edit', 'delete']);
const deletingItem = ref(null);
function requestDelete(item) { deletingItem.value = item; }
function confirmDelete() { if (deletingItem.value) emit('delete', deletingItem.value); deletingItem.value = null; }
function supplementary(item) { if (item.category === 'sponsor') return item.sponsorTier; if (item.category === 'organization') return item.supplierName; return [item.pressOrg, item.journalistName].filter((value) => value && value !== '—').join(' · ') || '—'; }
</script>

<template>
  <section class="space-y-4"><div><h2 class="text-[16px] font-semibold leading-[22px]">Dòng chi phí</h2><p class="mt-1 text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">Các số tiền và tổng số do PolicyEngine chiếu từ máy chủ; ứng dụng không tự cộng hoặc suy ra quyền.</p></div><section v-for="group in groups" :key="group.category" class="overflow-hidden rounded-lg border border-[var(--mds-border-light)]"><header class="flex min-h-[48px] items-center justify-between gap-3 bg-[var(--mds-bg-page)] px-3 py-2"><div><h3 class="text-[14px] font-semibold">{{ group.label }}</h3><p class="text-[12px] text-[var(--mds-text-secondary)]">Tổng: <strong class="text-[var(--mds-text)]">{{ group.total }}</strong></p></div><MButton v-if="canEdit" variant="neutral" @click="emit('add', group.category)">Thêm dòng</MButton></header><div v-if="group.items.length" class="divide-y divide-[var(--mds-border-light)]"><article v-for="item in group.items" :key="item.id" class="flex min-h-[60px] items-center justify-between gap-3 px-3 py-2"><div class="min-w-0"><strong class="block truncate text-[13px]">{{ item.title }}</strong><p class="mt-0.5 truncate text-[12px] text-[var(--mds-text-secondary)]">{{ supplementary(item) }}</p><a v-if="item.articleLink" :href="item.articleLink" target="_blank" rel="noopener" class="mt-1 inline-block text-[12px] font-medium text-[var(--mds-brand-700)] hover:underline">Mở link nghiệm thu</a></div><div class="flex shrink-0 flex-col items-end gap-1"><strong class="text-[13px]">{{ item.amount }}</strong><div class="flex gap-1"><MButton v-if="canEdit" variant="link" @click="emit('edit', item)">Sửa</MButton><MButton v-if="canDelete" variant="link" class="text-[var(--mds-danger)]" @click="requestDelete(item)">Xóa</MButton></div></div></article></div><MEmptyState v-else :title="`Chưa có chi phí ${group.label.toLowerCase()}`" description="Dòng chi phí được phép quản lý sẽ xuất hiện tại đây." /></section><p v-if="error" role="alert" class="rounded-lg bg-[var(--mds-danger-bg)] px-3 py-2 text-[13px] text-[var(--mds-danger)]">{{ error }}</p><MDialog :model-value="Boolean(deletingItem)" title="Xóa dòng chi phí?" type="danger" confirm-text="Xóa dòng" @update:model-value="(open) => { if (!open) deletingItem = null; }" @confirm="confirmDelete"><p>Không thể hoàn tác thao tác này.</p></MDialog></section>
</template>
