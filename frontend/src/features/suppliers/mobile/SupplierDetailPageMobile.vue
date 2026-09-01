<script setup>
import MButton from '../../../components/mds/MButton.vue';
import MEmptyState from '../../../components/mds/MEmptyState.vue';
import MMobileTopBar from '../../../components/mds/MMobileTopBar.vue';
defineProps({ detail: { type: Object, required: true }, safeAreaStyle: { type: Object, default: () => ({}) } });
const emit = defineEmits(['back']);
</script>

<template>
  <section class="mds-mobile-app flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-[var(--mds-bg)] text-[var(--mds-text)]" :style="safeAreaStyle"><MMobileTopBar :title="detail.name" @back="emit('back')" /><main class="min-h-0 flex-1 overflow-y-auto"><div class="mds-mobile-gutter-x border-b border-[var(--mds-border-light)] py-4"><p class="text-[14px] font-medium leading-5">{{ detail.subtitle }}</p><p class="mt-1 text-[12px] leading-4 text-[var(--mds-text-secondary)]">Hồ sơ nhà cung cấp</p></div><dl v-if="detail.fields.length" class="mds-mobile-gutter-x pb-4"><div v-for="field in detail.fields" :key="field[0]" class="mds-mobile-row-gap-4 flex min-h-[var(--mds-mobile-touch-target)] items-center gap-4 border-b border-[var(--mds-border-light)] py-2"><dt class="w-[124px] shrink-0 text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">{{ field[0] }}</dt><dd class="mds-mobile-readable min-w-0 flex-1 break-words text-right text-[13px] font-medium leading-[18px]">{{ field[1] }}</dd></div></dl><MEmptyState v-else title="Chưa có thông tin để hiển thị" description="Hồ sơ chưa có trường nào được phép xem." /><div class="mds-mobile-gutter-x pb-6"><MButton variant="neutral" class="w-full" @click="emit('back')">Quay lại danh sách</MButton></div></main></section>
</template>
