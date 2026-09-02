<script setup>
import MButton from '../../../components/mds/MButton.vue';
import MEmptyState from '../../../components/mds/MEmptyState.vue';
import MIcon from '../../../components/MIcon.vue';
defineProps({ dashboard: { type: Object, default: null } });
const emit = defineEmits(['navigate']);
</script>

<template>
  <section class="min-h-0 bg-[var(--mds-bg-page)] p-4"><div class="mx-auto max-w-[1200px] space-y-4">
    <header class="rounded-lg bg-[var(--mds-bg)] px-5 py-4 shadow-[var(--mds-shadow-card)]"><h1 class="text-[20px] font-semibold">Tổng quan PR Workstation</h1><p class="mt-1 text-[13px] text-[var(--mds-text-secondary)]">Quan hệ đối ngoại, lịch nhắc và hoạt động trong tháng {{ dashboard?.month }}/{{ dashboard?.year }}.</p></header>
    <MEmptyState v-if="!dashboard" title="Chưa có dữ liệu tổng quan" description="Kiểm tra lại quyền truy cập hoặc thử tải lại." />
    <template v-else>
      <section v-for="group in dashboard.groups" :key="group.key" class="rounded-lg bg-[var(--mds-bg)] p-5 shadow-[var(--mds-shadow-card)]"><div class="mb-4 flex items-center justify-between gap-3"><h2 class="flex items-center gap-2 text-[16px] font-semibold"><MIcon :name="group.icon" :size="20" />{{ group.title }}</h2><MButton variant="link" @click="emit('navigate', group.navigate)">Xem chi tiết</MButton></div><div class="grid gap-3 sm:grid-cols-3"><MButton v-for="stat in group.stats" :key="stat.label" variant="neutral" class="[&]:h-auto [&]:min-h-[92px] [&]:w-full [&]:justify-start [&]:bg-[var(--mds-bg-page)] [&]:px-4 [&]:py-4 [&]:text-left" @click="emit('navigate', stat.navigate)"><span class="block"><strong class="block text-[24px] leading-7">{{ stat.value }}</strong><span class="mt-1 block text-[13px] text-[var(--mds-text-secondary)]">{{ stat.label }}</span></span></MButton></div></section>
      <div class="grid gap-4 lg:grid-cols-3"><section v-for="chart in dashboard.charts" :key="chart.title" class="rounded-lg bg-[var(--mds-bg)] p-5 shadow-[var(--mds-shadow-card)]"><h2 class="text-[15px] font-semibold">{{ chart.title }}</h2><MEmptyState v-if="!chart.rows.length" title="Chưa có dữ liệu" description="Dữ liệu sẽ xuất hiện khi có phát sinh."/><div v-else class="mt-4 space-y-3"><div v-for="row in chart.rows" :key="row.label" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><span class="truncate text-[13px]">{{ row.label }}</span><strong class="text-[13px]">{{ row.value }}</strong></div></div></section><section class="rounded-lg bg-[var(--mds-bg)] p-5 shadow-[var(--mds-shadow-card)]"><div class="flex items-center justify-between gap-3"><h2 class="text-[15px] font-semibold">Sắp tới</h2><MButton variant="link" @click="emit('navigate', 'reminders')">Lịch nhắc</MButton></div><MEmptyState v-if="!dashboard.upcoming.length" title="Chưa có lịch gần" description="Không có mốc trong 60 ngày tới."/><div v-else class="mt-4 divide-y divide-[var(--mds-border-light)]"><MButton v-for="item in dashboard.upcoming" :key="`${item.title}-${item.date}`" variant="ghost" class="[&]:h-auto [&]:w-full [&]:justify-start [&]:px-0 [&]:py-3 [&]:text-left" @click="emit('navigate', item.navigate)"><span class="block"><strong class="block text-[13px]">{{ item.title }}</strong><span class="mt-1 block text-[12px] text-[var(--mds-text-secondary)]">{{ item.date || 'Chưa có ngày' }}<span v-if="item.daysUntil !== null"> · còn {{ item.daysUntil }} ngày</span></span></span></MButton></div></section></div>
    </template>
  </div></section>
</template>
