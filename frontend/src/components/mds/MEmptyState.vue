<script setup>
defineProps({ title: { type: String, default: '' }, description: { type: String, default: '' } });
</script>

<template>
  <div class="flex flex-col items-center px-6 pb-10 pt-[120px] text-center">
    <div class="mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--mds-bg-disabled)] text-[var(--mds-text-placeholder)]" aria-hidden="true">—</div>
    <p v-if="title" class="text-[13px] font-semibold leading-[18px] text-[var(--mds-text)]">{{ title }}</p>
    <p v-if="description" class="mt-1 max-w-[360px] text-[13px] leading-[18px] text-[var(--mds-text-placeholder)]">{{ description }}</p>
    <div v-if="$slots.actions" class="mt-6 flex items-center justify-center gap-2"><slot name="actions" /></div>
  </div>
</template>
