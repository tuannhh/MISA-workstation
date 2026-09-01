<script setup>
import MEmptyState from '../../../components/mds/MEmptyState.vue';
import MMobileTopBar from '../../../components/mds/MMobileTopBar.vue';
import MTag from '../../../components/mds/MTag.vue';
defineProps({ rows: { type: Array, default: () => [] }, safeAreaStyle: Object });
const emit = defineEmits(['back']);
</script>

<template>
  <section class="mds-mobile-app flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-[var(--mds-bg)]" :style="safeAreaStyle">
    <MMobileTopBar title="Nhật ký audit" @back="emit('back')"/>
    <main class="min-h-0 flex-1 overflow-y-auto pb-[var(--mds-mobile-safe-bottom)]">
      <div v-if="rows.length" class="divide-y divide-[var(--mds-border-light)]">
        <article v-for="row in rows" :key="row.id" class="mds-mobile-gutter-x py-3">
          <div class="flex items-start justify-between gap-3"><MTag color="brand">{{ row.action }}</MTag><time class="shrink-0 text-[12px] text-[var(--mds-text-secondary)]">{{ row.timestamp }}</time></div>
          <strong class="mt-2 block truncate text-[14px]">{{ row.entity }}<span v-if="row.entityId != null"> #{{ row.entityId }}</span></strong>
          <p class="mt-1 truncate text-[13px] text-[var(--mds-text-secondary)]" :title="row.detail">{{ row.detail }}</p>
          <p class="mt-1 text-[12px] text-[var(--mds-text-placeholder)]">{{ row.actor }}</p>
        </article>
      </div>
      <MEmptyState v-else title="Chưa có hoạt động được ghi nhận" description="Máy chủ chưa trả dữ liệu audit."/>
    </main>
  </section>
</template>
