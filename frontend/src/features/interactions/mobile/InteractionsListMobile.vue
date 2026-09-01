<script setup>
import { ref, watch } from 'vue';
import MButton from '../../../components/mds/MButton.vue';
import MEmptyState from '../../../components/mds/MEmptyState.vue';
import MInput from '../../../components/mds/MInput.vue';
import MMobileTopBar from '../../../components/mds/MMobileTopBar.vue';
import MTag from '../../../components/mds/MTag.vue';

const props = defineProps({ rows: { type: Array, default: () => [] }, total: { type: Number, default: 0 }, page: { type: Number, default: 1 }, pageSize: { type: Number, default: 20 }, search: { type: String, default: '' }, loading: { type: Boolean, default: false }, canCreate: { type: Boolean, default: false }, safeAreaStyle: { type: Object, default: () => ({}) } });
const emit = defineEmits(['search', 'page', 'create', 'voice', 'back']);
const query = ref(props.search);
watch(() => props.search, (value) => { query.value = value; });
function submit() { emit('search', query.value.trim()); }
</script>

<template>
  <section class="mds-mobile-app flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-[var(--mds-bg)]" :style="safeAreaStyle">
    <MMobileTopBar title="Lịch sử tương tác" @back="emit('back')"><template #actions><MButton v-if="canCreate" variant="link" :disabled="loading" @click="emit('voice')">Giọng nói</MButton></template></MMobileTopBar>
    <form class="mds-mobile-gutter-x flex shrink-0 gap-2 border-b border-[var(--mds-border-light)] py-3" @submit.prevent="submit"><MInput v-model="query" placeholder="Tìm tương tác…" :disabled="loading" /><MButton variant="primary" :loading="loading" @click="submit">Tìm</MButton></form>
    <div class="min-h-0 flex-1 overflow-y-auto"><div v-if="rows.length" class="divide-y divide-[var(--mds-border-light)]"><article v-for="row in rows" :key="row.id" class="mds-mobile-gutter-x py-3"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><strong class="block text-[14px] leading-5">{{ row.partnerName }}</strong><span class="mt-0.5 block text-[13px] text-[var(--mds-text-secondary)]">{{ row.date }} · {{ row.channel }}</span></div><MTag color="neutral">{{ row.partnerType }}</MTag></div><p class="mt-2 text-[13px] leading-[18px]">{{ row.summary }}</p><p class="mt-1 text-[12px] text-[var(--mds-text-secondary)]">{{ row.result }} · {{ row.staff }}</p></article></div><MEmptyState v-else-if="!loading" title="Chưa có tương tác" description="Khi có ghi nhận trao đổi, chúng sẽ xuất hiện ở đây." /><div v-else class="p-6 text-center text-[13px] text-[var(--mds-text-secondary)]">Đang tải tương tác…</div></div>
    <footer class="flex shrink-0 justify-between border-t border-[var(--mds-border-light)] bg-[var(--mds-bg)] px-4 pb-[calc(12px+var(--mds-mobile-safe-bottom))] pt-3"><MButton variant="neutral" :disabled="loading || page <= 1" @click="emit('page', page - 1)">Trước</MButton><span class="self-center text-[12px] text-[var(--mds-text-secondary)]">{{ total }} mục</span><MButton variant="neutral" :disabled="loading || page * pageSize >= total" @click="emit('page', page + 1)">Sau</MButton></footer>
  </section>
</template>
