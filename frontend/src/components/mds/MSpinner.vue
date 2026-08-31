<script setup>
defineProps({ size: { type: Number, default: 16 } });
</script>

<template>
  <svg class="animate-spin shrink-0" :width="size" :height="size" viewBox="0 0 24 24" fill="none" role="status" aria-label="Đang tải">
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" opacity="0.2" />
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="42" stroke-dashoffset="28" />
  </svg>
</template>
