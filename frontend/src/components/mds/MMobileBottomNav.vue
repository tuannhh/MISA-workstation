<script setup>
import MIcon from '../MIcon.vue';

defineProps({
  items: { type: Array, default: () => [] },
});

const emit = defineEmits(['navigate']);
</script>

<template>
  <nav class="shrink-0 border-t border-[var(--mds-border-light)] bg-[var(--mds-bg)] pb-[var(--mds-mobile-safe-bottom)]" aria-label="Điều hướng chính của ứng dụng">
    <div class="flex h-[var(--mds-mobile-bottom-nav-height)] items-stretch px-1">
      <button
        v-for="item in items"
        :key="item.key"
        type="button"
        class="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-medium leading-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--mds-brand-600)] disabled:cursor-not-allowed disabled:text-[var(--mds-text-placeholder)]"
        :class="item.active ? 'text-[var(--mds-brand-700)]' : 'text-[var(--mds-text-secondary)] hover:bg-[var(--mds-bg-hover-soft)] active:bg-[var(--mds-brand-100)]'"
        :disabled="item.disabled"
        :aria-current="item.active ? 'page' : undefined"
        @click="emit('navigate', item.key)"
      >
        <span class="grid h-7 w-11 place-items-center rounded-full" :class="item.active ? 'bg-[var(--mds-brand-100)]' : ''">
          <MIcon :name="item.icon" :size="20" />
        </span>
        <span class="max-w-full truncate">{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>
