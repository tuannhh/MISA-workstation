<script setup>
import { ref } from 'vue';
import MButton from '../../../components/mds/MButton.vue';
import MEmptyState from '../../../components/mds/MEmptyState.vue';
import MTag from '../../../components/mds/MTag.vue';
import MTabs from '../../../components/mds/MTabs.vue';

defineProps({ detail: { type: Object, required: true } });
const emit = defineEmits(['back', 'navigate']);
const activeTab = ref('overview');
const tabs = [{ key: 'overview', label: 'Thông tin chung' }, { key: 'people', label: 'Nhân sự' }, { key: 'dates', label: 'Ngày nhắc' }];
</script>

<template>
  <section class="min-h-0 bg-[var(--mds-bg-page)] p-4">
    <header class="mb-4 flex min-w-0 items-center justify-between gap-4 rounded-lg bg-[var(--mds-bg)] px-4 py-3 shadow-[var(--mds-shadow-card)]">
      <div class="min-w-0"><div class="flex min-w-0 items-center gap-2"><h1 class="truncate text-[20px] font-semibold leading-7 text-[var(--mds-text)]">{{ detail.name }}</h1><MTag color="brand" class="shrink-0">{{ detail.typeLabel }}</MTag></div><p class="mt-1 truncate text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">{{ detail.subtitle }}</p></div>
      <MButton variant="neutral" class="shrink-0" @click="emit('back')">Danh sách</MButton>
    </header>
    <div class="rounded-lg bg-[var(--mds-bg)] shadow-[var(--mds-shadow-card)]">
      <MTabs v-model="activeTab" :tabs="tabs" class="[&>[role=tablist]]:px-4">
        <div v-if="activeTab === 'overview'" class="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section class="min-w-0"><h2 class="text-[16px] font-semibold leading-[22px]">Thông tin được phép xem</h2><dl class="mt-3 grid gap-x-8 sm:grid-cols-2"><div v-for="field in detail.fields" :key="field[0]" class="grid grid-cols-[136px_minmax(0,1fr)] gap-3 border-b border-[var(--mds-border-light)] py-2.5"><dt class="text-[12px] leading-4 text-[var(--mds-text-secondary)]">{{ field[0] }}</dt><dd class="min-w-0 break-words text-[13px] font-medium leading-[18px] text-[var(--mds-text)]">{{ field[1] }}</dd></div></dl></section>
          <aside class="rounded-lg bg-[var(--mds-bg-page)] p-4"><h2 class="text-[14px] font-semibold leading-5">Phạm vi pilot</h2><p class="mt-2 text-[13px] leading-[18px] text-[var(--mds-text-secondary)]">Chỉ thông tin cơ quan, nhân sự và ngày nhắc được chuyển ở slice này. Hội phí, tài trợ, MOU và chỉnh sửa vẫn giữ luồng legacy để tránh thay đổi quyền ngoài phạm vi.</p><dl class="mt-4 space-y-3 text-[13px]"><div class="flex justify-between gap-3"><dt class="text-[var(--mds-text-secondary)]">Nhân sự</dt><dd class="font-medium">{{ detail.people.length }}</dd></div><div class="flex justify-between gap-3"><dt class="text-[var(--mds-text-secondary)]">Ngày nhắc</dt><dd class="font-medium">{{ detail.dates.length }}</dd></div></dl></aside>
        </div>
        <section v-else-if="activeTab === 'people'" class="p-4"><h2 class="text-[16px] font-semibold leading-[22px]">Nhân sự liên quan</h2><div v-if="detail.people.length" class="mt-3 divide-y divide-[var(--mds-border-light)]"><MButton v-for="person in detail.people" :key="person.id" variant="link" class="flex min-h-14 h-auto w-full items-center justify-between gap-4 rounded-none py-3 text-left hover:bg-[var(--mds-brand-50)]" @click="emit('navigate', person.id)"><span class="min-w-0"><strong class="block truncate text-[13px]">{{ person.name }}</strong><span class="mt-1 block truncate text-[12px] text-[var(--mds-text-secondary)]">{{ person.role }}</span></span><span class="shrink-0 text-[var(--mds-brand-600)]" aria-hidden="true">›</span></MButton></div><MEmptyState v-else title="Chưa có nhân sự" description="Nhân sự được tạo trong luồng quản lý danh bạ." /></section>
        <section v-else class="p-4"><h2 class="text-[16px] font-semibold leading-[22px]">Ngày nhắc liên quan</h2><div v-if="detail.dates.length" class="mt-3 divide-y divide-[var(--mds-border-light)]"><div v-for="date in detail.dates" :key="date.id" class="flex min-h-14 items-center justify-between gap-4 py-3"><span class="min-w-0"><strong class="block truncate text-[13px]">{{ date.title }}</strong><span v-if="date.recurring" class="mt-1 block text-[12px] text-[var(--mds-text-secondary)]">Lặp lại hằng năm</span></span><span class="shrink-0 text-[13px] font-medium">{{ date.date }}</span></div></div><MEmptyState v-else title="Chưa có ngày nhắc" description="Ngày thành lập và các mốc hợp tác sẽ xuất hiện tại đây khi được tạo." /></section>
      </MTabs>
    </div>
  </section>
</template>
