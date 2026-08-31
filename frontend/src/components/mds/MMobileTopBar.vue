<script setup>
import MButton from './MButton.vue';
import MIcon from '../MIcon.vue';

defineProps({ title: { type: String, required: true }, showBack: { type: Boolean, default: true } });
const emit = defineEmits(['back']);
</script>

<template>
  <header class="shrink-0 border-b border-[var(--mds-border-light)] bg-[var(--mds-bg)]" :style="{ paddingTop: 'var(--mds-mobile-safe-top)' }">
    <div class="mds-mobile-row-gap-1 flex h-[var(--mds-mobile-topbar-height)] min-w-0 items-center gap-1 px-2">
      <MButton v-if="showBack" variant="icon" class="[&]:h-[var(--mds-mobile-touch-target)] [&]:w-[var(--mds-mobile-touch-target)] [&]:rounded-full" aria-label="Quay lại MISA AMIS" @click="emit('back')"><template #icon><MIcon name="chevron-left" :size="24" /></template></MButton>
      <h1 class="min-w-0 flex-1 truncate px-1 text-[20px] font-semibold leading-7 text-[var(--mds-text)]">{{ title }}</h1>
      <div v-if="$slots.actions" class="mds-mobile-row-gap-1 flex shrink-0 items-center gap-1"><slot name="actions" /></div>
    </div>
  </header>
</template>
