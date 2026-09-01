<script setup>
import MButton from '../../../components/mds/MButton.vue';
import MEmptyState from '../../../components/mds/MEmptyState.vue';
import MTag from '../../../components/mds/MTag.vue';
defineProps({ rows: { type: Array, default: () => [] } });
const emit = defineEmits(['back']);
</script>

<template>
  <section class="min-h-0 bg-[var(--mds-bg-page)] p-4">
    <div class="mx-auto max-w-[1200px] space-y-4">
      <header class="flex items-start justify-between gap-4 rounded-lg bg-[var(--mds-bg)] px-5 py-4 shadow-[var(--mds-shadow-card)]">
        <div><h1 class="text-[20px] font-semibold">Nhật ký audit</h1><p class="mt-1 text-[13px] text-[var(--mds-text-secondary)]">200 hoạt động gần nhất. Chỉ Super Admin có quyền xem.</p></div>
        <MButton variant="secondary" @click="emit('back')">Quay lại</MButton>
      </header>
      <section class="overflow-hidden rounded-lg bg-[var(--mds-bg)] shadow-[var(--mds-shadow-card)]">
        <MEmptyState v-if="!rows.length" title="Chưa có hoạt động được ghi nhận" description="Máy chủ chưa trả dữ liệu audit."/>
        <table v-else class="w-full text-left"><thead class="bg-[var(--mds-bg-page)] text-[12px] text-[var(--mds-text-secondary)]"><tr><th class="px-5 py-3">Thời gian</th><th class="px-3 py-3">Người thực hiện</th><th class="px-3 py-3">Hoạt động</th><th class="px-3 py-3">Đối tượng</th><th class="px-5 py-3">Chi tiết</th></tr></thead><tbody class="divide-y divide-[var(--mds-border-light)]"><tr v-for="row in rows" :key="row.id"><td class="whitespace-nowrap px-5 py-3 text-[13px]">{{ row.timestamp }}</td><td class="px-3 py-3 text-[13px]">{{ row.actor }}</td><td class="px-3 py-3"><MTag color="brand">{{ row.action }}</MTag></td><td class="px-3 py-3 text-[13px]">{{ row.entity }}<span v-if="row.entityId != null"> #{{ row.entityId }}</span></td><td class="max-w-[360px] truncate px-5 py-3 text-[13px]" :title="row.detail">{{ row.detail }}</td></tr></tbody></table>
      </section>
    </div>
  </section>
</template>
