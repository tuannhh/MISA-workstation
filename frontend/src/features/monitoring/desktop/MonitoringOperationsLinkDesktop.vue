<script setup>
import MButton from '../../../components/mds/MButton.vue';
defineEmits(['open']);
</script>
<template><div class="pointer-events-none fixed bottom-6 right-6 z-20"><MButton variant="primary" class="pointer-events-auto shadow-lg" @click="$emit('open')">Vận hành giám sát</MButton></div></template>
