<script setup>
import MButton from '../../../components/mds/MButton.vue';
defineEmits(['open']);
</script>
<template><div class="pointer-events-none fixed bottom-[calc(var(--mds-mobile-safe-bottom)+16px)] left-4 right-4 z-20"><MButton variant="primary" class="pointer-events-auto w-full [&]:h-[var(--mds-mobile-touch-target)]" @click="$emit('open')">Vận hành giám sát</MButton></div></template>
