<script setup>
import MButton from '../../../components/mds/MButton.vue';
import MEmptyState from '../../../components/mds/MEmptyState.vue';
defineProps({ detail: { type: Object, required: true }, canEdit: { type: Boolean, default: false } });
const emit = defineEmits(['back', 'edit']);
</script>

<template>
  <section class="min-h-0 bg-[var(--mds-bg-page)] p-4">
    <header class="mb-4 flex min-w-0 items-center justify-between gap-4 rounded-lg bg-[var(--mds-bg)] px-4 py-3 shadow-[var(--mds-shadow-card)]"><div class="min-w-0"><h1 class="truncate text-[20px] font-semibold leading-7 text-[var(--mds-text)]">{{ detail.name }}</h1><p class="mt-1 truncate text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">{{ detail.subtitle }}</p></div><div class="flex shrink-0 items-center gap-2"><MButton variant="neutral" @click="emit('back')">Danh sách nhà cung cấp</MButton><MButton v-if="canEdit" variant="primary" @click="emit('edit')">Chỉnh sửa</MButton></div></header>
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"><section class="rounded-lg bg-[var(--mds-bg)] p-4 shadow-[var(--mds-shadow-card)]"><h2 class="text-[16px] font-semibold leading-[22px] text-[var(--mds-text)]">Thông tin được phép xem</h2><dl v-if="detail.fields.length" class="mt-3 grid gap-x-8 sm:grid-cols-2"><div v-for="field in detail.fields" :key="field[0]" class="grid grid-cols-[132px_minmax(0,1fr)] gap-3 border-b border-[var(--mds-border-light)] py-2.5"><dt class="text-[12px] leading-4 text-[var(--mds-text-secondary)]">{{ field[0] }}</dt><dd class="min-w-0 break-words text-[13px] font-medium leading-[18px] text-[var(--mds-text)]">{{ field[1] }}</dd></div></dl><MEmptyState v-else title="Chưa có thông tin để hiển thị" description="Hồ sơ chưa có trường nào được phép xem." /></section><aside class="rounded-lg bg-[var(--mds-bg)] p-4 shadow-[var(--mds-shadow-card)]"><h2 class="text-[14px] font-semibold leading-5">Phạm vi pilot</h2><p class="mt-2 text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">Slice này chỉ hiển thị hồ sơ đã được máy chủ chiếu theo quyền. Báo giá, giao dịch, đầu mối và tệp tiếp tục ở luồng legacy cho đến slice policy riêng.</p></aside></div>
  </section>
</template>
