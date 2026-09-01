<script setup>
import { ref, watch } from 'vue';
import MButton from '../../../components/mds/MButton.vue';
import MEmptyState from '../../../components/mds/MEmptyState.vue';
import MInput from '../../../components/mds/MInput.vue';
import MTag from '../../../components/mds/MTag.vue';

const props = defineProps({ rows: { type: Array, default: () => [] }, total: Number, page: Number, pageSize: Number, search: String, loading: Boolean, canCreate: Boolean });
const emit = defineEmits(['search', 'page', 'open', 'create']);
const query = ref(props.search || '');
watch(() => props.search, (value) => { query.value = value || ''; });
</script>

<template>
  <section class="min-h-0 bg-[var(--mds-bg-page)] p-4">
    <div class="mx-auto max-w-[1200px] space-y-4">
      <header class="rounded-lg bg-[var(--mds-bg)] px-5 py-4 shadow-[var(--mds-shadow-card)]">
        <div class="flex items-start justify-between gap-3">
          <div><h1 class="text-[20px] font-semibold">Giải thưởng</h1><p class="mt-1 text-[13px] text-[var(--mds-text-secondary)]">Danh sách giải thưởng từ projection R062.</p></div>
          <MButton v-if="canCreate" variant="primary" @click="emit('create')">Thêm giải thưởng</MButton>
        </div>
        <form class="mt-4 flex max-w-[560px] gap-2" @submit.prevent="emit('search', query.trim())">
          <MInput v-model="query" placeholder="Tìm giải thưởng hoặc đơn vị tổ chức…" />
          <MButton variant="primary" :loading="loading" @click="emit('search', query.trim())">Tìm</MButton>
        </form>
      </header>
      <section class="overflow-hidden rounded-lg bg-[var(--mds-bg)] shadow-[var(--mds-shadow-card)]">
        <div class="border-b border-[var(--mds-border-light)] px-5 py-3 text-[13px] text-[var(--mds-text-secondary)]">{{ total || 0 }} giải thưởng</div>
        <table v-if="rows.length" class="w-full text-left"><tbody class="divide-y divide-[var(--mds-border-light)]"><tr v-for="row in rows" :key="row.id" tabindex="0" class="cursor-pointer hover:bg-[var(--mds-bg-page)]" @click="emit('open', row.id)" @keydown.enter="emit('open', row.id)"><td class="px-5 py-3"><strong class="block text-[13px]">{{ row.name }}</strong><span class="text-[12px] text-[var(--mds-text-secondary)]">{{ row.deadline }} · {{ row.organizer }}</span></td><td class="px-5 py-3 text-right"><MTag color="neutral">{{ row.status }}</MTag></td></tr></tbody></table>
        <MEmptyState v-else title="Chưa có giải thưởng" description="Giải thưởng được phép xem sẽ xuất hiện tại đây." />
        <footer class="flex items-center justify-between border-t border-[var(--mds-border-light)] px-5 py-3"><MButton variant="neutral" :disabled="loading || page <= 1" @click="emit('page', page - 1)">Trước</MButton><span class="text-[12px] text-[var(--mds-text-secondary)]">Trang {{ page || 1 }}</span><MButton variant="neutral" :disabled="loading || page * pageSize >= total" @click="emit('page', page + 1)">Sau</MButton></footer>
      </section>
    </div>
  </section>
</template>
