<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import MEmptyState from '../../components/mds/MEmptyState.vue';
import MSpinner from '../../components/mds/MSpinner.vue';
import { HostEvent, HostSurface } from '../../platform/host-adapter.mjs';
import { createDashboardApi, DashboardApiError } from './domain/dashboard-api.mjs';
import { dashboardViewModel } from './domain/dashboard-view.mjs';
import DashboardDesktop from './desktop/DashboardDesktop.vue';
import DashboardMobile from './mobile/DashboardMobile.vue';

const props = defineProps({ surface: { type: String, required: true }, adapter: { type: Object, default: null }, hostUnavailable: { type: Boolean, default: false }, nativeNavigation: { type: Array, default: () => [] } });
const emit = defineEmits(['navigate']);
const api = createDashboardApi();
const state = reactive({ phase: 'loading', dashboard: null, error: null });
const safeArea = ref(props.adapter?.getSafeArea?.() || {});
const unsubscribers = [];
const isNative = computed(() => props.surface === HostSurface.NATIVE);
const safeAreaStyle = computed(() => Object.fromEntries(['top', 'right', 'bottom', 'left'].flatMap((side) => Number.isFinite(Number(safeArea.value?.[side])) ? [[`--mds-mobile-safe-${side}`, `${Number(safeArea.value[side])}px`]] : [])));

async function load() {
  if (props.hostUnavailable) {
    state.error = new DashboardApiError({ status: 503, code: 'HOST_ADAPTER_UNAVAILABLE', message: 'Native host chưa sẵn sàng. Ứng dụng không chuyển sang giao diện desktop thay thế.' });
    state.phase = 'error';
    return;
  }
  state.phase = 'loading'; state.error = null;
  try { state.dashboard = dashboardViewModel(await api.getOverview()); state.phase = 'ready'; }
  catch (error) { state.error = error instanceof DashboardApiError ? error : new DashboardApiError({ status: 0, code: 'DASHBOARD_NETWORK', message: 'Không thể tải tổng quan. Vui lòng thử lại.' }); state.phase = 'error'; }
}
function listenToHost() {
  if (!props.adapter || props.hostUnavailable) return;
  unsubscribers.push(props.adapter.subscribe(HostEvent.VIEWPORT, (payload) => { if (payload?.safeArea) safeArea.value = { ...safeArea.value, ...payload.safeArea }; }));
  unsubscribers.push(props.adapter.subscribe(HostEvent.LIFECYCLE, (payload) => { if (payload?.state === 'foreground') load(); }));
}
onMounted(() => { listenToHost(); load(); });
onBeforeUnmount(() => { while (unsubscribers.length) unsubscribers.pop()(); });
</script>

<template>
  <div v-if="state.phase === 'loading'" :class="isNative ? 'mds-mobile-app grid h-[100dvh] place-items-center bg-[var(--mds-bg)]' : 'grid min-h-[360px] place-items-center bg-[var(--mds-bg-page)]'" :style="isNative ? safeAreaStyle : undefined"><MSpinner :size="28" /></div>
  <section v-else-if="state.phase === 'error'" :class="isNative ? 'mds-mobile-app min-h-[100dvh] bg-[var(--mds-bg)]' : 'min-h-[360px] bg-[var(--mds-bg-page)]'" :style="isNative ? safeAreaStyle : undefined"><MEmptyState :title="state.error.status === 403 ? 'Bạn không có quyền xem tổng quan' : 'Không thể mở tổng quan'" :description="state.error.message" /></section>
  <DashboardMobile v-else-if="isNative" :dashboard="state.dashboard" :safe-area-style="safeAreaStyle" :native-navigation="nativeNavigation" @navigate="emit('navigate', $event)" />
  <DashboardDesktop v-else :dashboard="state.dashboard" @navigate="emit('navigate', $event)" />
</template>
