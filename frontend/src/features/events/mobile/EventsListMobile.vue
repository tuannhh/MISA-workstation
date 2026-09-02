<script setup>
import { computed, ref, watch } from 'vue';
import MHeaderIconAva from '../../../components/MHeaderIconAva.vue';
import MIcon from '../../../components/MIcon.vue';
import MButton from '../../../components/mds/MButton.vue';
import MDialog from '../../../components/mds/MDialog.vue';
import MEmptyState from '../../../components/mds/MEmptyState.vue';
import MInput from '../../../components/mds/MInput.vue';
import MMobileBottomNav from '../../../components/mds/MMobileBottomNav.vue';
import MMobileTopBar from '../../../components/mds/MMobileTopBar.vue';
import MTag from '../../../components/mds/MTag.vue';

const props = defineProps({
  rows: { type: Array, default: () => [] },
  total: { type: Number, default: 0 },
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 20 },
  search: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  canCreate: { type: Boolean, default: false },
  canIntake: { type: Boolean, default: false },
  safeAreaStyle: { type: Object, default: () => ({}) },
  nativeNavigation: { type: Array, default: () => [] },
});
const emit = defineEmits(['back', 'search', 'page', 'create', 'intake', 'open', 'navigate']);

const query = ref(props.search);
const moreOpen = ref(false);
const primaryKeys = new Set(['people', 'interactions', 'events']);
const primaryNavigation = computed(() => [
  ...props.nativeNavigation.filter((item) => primaryKeys.has(item.key)),
  { key: 'more', label: 'Khác', icon: 'dots-circle-horizontal', active: false },
]);
const moreNavigation = computed(() => props.nativeNavigation.filter((item) => !primaryKeys.has(item.key)));

watch(() => props.search, (value) => { query.value = value; });

function submitSearch() { emit('search', query.value.trim()); }
function navigate(key) {
  if (key === 'more') { moreOpen.value = true; return; }
  emit('navigate', key);
}
function navigateMore(key) { moreOpen.value = false; emit('navigate', key); }
</script>

<template>
  <section class="mds-mobile-app relative flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-[var(--mds-bg)]" :style="safeAreaStyle">
    <MMobileTopBar title="Sự kiện" @back="emit('back')">
      <template #actions>
        <MButton
          v-if="canIntake"
          variant="icon"
          size="lg"
          class="[&]:rounded-full [&_svg]:!h-7 [&_svg]:!w-7"
          title="Trợ lý số MISA AVA — nhập nhanh sự kiện"
          aria-label="Mở Trợ lý số MISA AVA để tạo sự kiện"
          @click="emit('intake')"
        >
          <template #icon><MHeaderIconAva :size="28" /></template>
        </MButton>
      </template>
    </MMobileTopBar>

    <form class="mds-mobile-gutter-x flex shrink-0 gap-2 border-b border-[var(--mds-border-light)] py-3" @submit.prevent="submitSearch">
      <MInput v-model="query" placeholder="Tìm sự kiện…" :disabled="loading" />
      <MButton variant="primary" :loading="loading" @click="submitSearch">Tìm</MButton>
    </form>

    <main class="min-h-0 flex-1 overflow-y-auto pb-20">
      <div v-if="rows.length" class="divide-y divide-[var(--mds-border-light)]">
        <button v-for="row in rows" :key="row.id" type="button" class="mds-mobile-gutter-x block min-h-16 w-full py-3 text-left" @click="emit('open', row.id)">
          <div class="flex items-start justify-between gap-3"><strong class="min-w-0 text-[14px] leading-5">{{ row.name }}</strong><MTag color="neutral">{{ row.status || '—' }}</MTag></div>
          <p class="mt-1 text-[13px] text-[var(--mds-text-secondary)]">{{ row.start_time || 'Chưa có thời gian' }} · {{ row.organizer || row.org_name || '—' }}</p>
        </button>
      </div>
      <MEmptyState v-else-if="!loading" title="Chưa có sự kiện" description="Bắt đầu bằng một sự kiện mới hoặc để AVA bóc tách kế hoạch thành bản nháp.">
        <template #actions>
          <MButton v-if="canCreate" variant="primary" @click="emit('create')"><template #icon><MIcon name="calendar-event" :size="16" /></template>Thêm sự kiện</MButton>
          <MButton v-if="canIntake" variant="neutral" @click="emit('intake')"><template #icon><MHeaderIconAva :size="20" /></template>Nhờ AVA hỗ trợ</MButton>
        </template>
      </MEmptyState>
      <div v-else class="p-6 text-center text-[13px] text-[var(--mds-text-secondary)]">Đang tải sự kiện…</div>
    </main>

    <MButton
      v-if="canCreate"
      variant="primary"
      class="absolute bottom-[calc(var(--mds-mobile-bottom-nav-height)+var(--mds-mobile-safe-bottom)+16px)] right-4 z-10 shadow-[var(--mds-shadow-md)]"
      aria-label="Thêm sự kiện"
      @click="emit('create')"
    >
      <template #icon><MIcon name="calendar-event" :size="16" /></template>
      Thêm sự kiện
    </MButton>

    <footer class="flex shrink-0 justify-between border-t border-[var(--mds-border-light)] bg-[var(--mds-bg)] px-4 py-3">
      <MButton variant="neutral" :disabled="loading || page <= 1" @click="emit('page', page - 1)">Trước</MButton>
      <span class="self-center text-[12px] text-[var(--mds-text-secondary)]">{{ total }} mục</span>
      <MButton variant="neutral" :disabled="loading || page * pageSize >= total" @click="emit('page', page + 1)">Sau</MButton>
    </footer>
    <MMobileBottomNav :items="primaryNavigation" @navigate="navigate" />
  </section>

  <MDialog v-model="moreOpen" title="Khám phá PR Workstation" confirm-text="Đóng">
    <p class="mb-3 text-[13px] text-[var(--mds-text-secondary)]">Chọn phân hệ cần làm việc. Dữ liệu và quyền luôn được kiểm tra lại bởi máy chủ.</p>
    <div class="grid gap-2">
      <MButton v-for="item in moreNavigation" :key="item.key" variant="neutral" class="[&]:w-full [&]:justify-start" :disabled="item.disabled" @click="navigateMore(item.key)">
        <template #icon><MIcon :name="item.icon" :size="20" /></template>
        {{ item.label }}
      </MButton>
    </div>
  </MDialog>
</template>
