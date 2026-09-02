<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import MIcon from '../../../components/MIcon.vue';
import MButton from '../../../components/mds/MButton.vue';
import { HostEvent } from '../../../platform/host-adapter.mjs';

const props = defineProps({ adapter: { type: Object, required: true } });
const emit = defineEmits(['launch']);
const allowed = ref(false);
const safeArea = ref(props.adapter.getSafeArea());
let unsubscribe = null;
const style = computed(() => ({
  '--mds-mobile-safe-bottom': `${Number(safeArea.value?.bottom) || 0}px`,
  '--mds-mobile-safe-right': `${Number(safeArea.value?.right) || 0}px`,
}));

async function loadPermission() {
  try {
    const response = await fetch('/api/me', { credentials: 'same-origin' });
    const payload = await response.json().catch(() => null);
    allowed.value = response.ok && payload?.permissions?.modules?.interactions?.includes('create') === true;
  } catch {
    // Không biết principal/quyền thì không render entry point. Server vẫn là authority.
    allowed.value = false;
  }
}

onMounted(() => {
  unsubscribe = props.adapter.subscribe(HostEvent.VIEWPORT, (payload) => {
    if (payload?.safeArea) safeArea.value = { ...safeArea.value, ...payload.safeArea };
  });
  loadPermission();
});
onBeforeUnmount(() => unsubscribe?.());
</script>

<template>
  <MButton
    v-if="allowed"
    variant="primary"
    class="fixed bottom-[calc(16px+var(--mds-mobile-safe-bottom))] right-[calc(16px+var(--mds-mobile-safe-right))] z-40 rounded-full shadow-lg [&]:h-[var(--mds-mobile-touch-target)] [&]:min-w-[var(--mds-mobile-touch-target)] [&]:px-3"
    :style="style"
    aria-label="Tạo đề xuất từ tệp ghi âm"
    @click="emit('launch')"
  >
    <template #icon><MIcon name="microphone" :size="20" /></template>
    Giọng nói
  </MButton>
</template>
