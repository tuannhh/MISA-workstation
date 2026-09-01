<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import MEmptyState from '../../components/mds/MEmptyState.vue';
import MMobileTopBar from '../../components/mds/MMobileTopBar.vue';
import MSpinner from '../../components/mds/MSpinner.vue';
import { HostEvent, HostSurface } from '../../platform/host-adapter.mjs';
import { createPartnerApi, PartnerApiError } from './domain/partner-api.mjs';
import { partnerDetailViewModel } from './domain/partner-detail.mjs';
import PartnerDetailPage from './desktop/PartnerDetailPage.vue';
import PartnerDetailPageMobile from './mobile/PartnerDetailPageMobile.vue';

const props = defineProps({ partnerId: { type: Number, required: true }, surface: { type: String, required: true }, adapter: { type: Object, default: null }, hostUnavailable: { type: Boolean, default: false } });
const emit = defineEmits(['back', 'navigate']);
const api = createPartnerApi();
const state = reactive({ phase: 'loading', detail: null, error: null });
const safeArea = ref(props.adapter?.getSafeArea?.() || {});
const unsubscribers = [];
const isNative = computed(() => props.surface === HostSurface.NATIVE);
const safeAreaStyle = computed(() => Object.fromEntries(['top', 'right', 'bottom', 'left'].flatMap((side) => Number.isFinite(Number(safeArea.value?.[side])) ? [[`--mds-mobile-safe-${side}`, `${Number(safeArea.value[side])}px`]] : [])));

function setError(error) {
  state.phase = 'error';
  state.error = error instanceof PartnerApiError ? error : new PartnerApiError({ status: 0, code: 'PARTNER_DETAIL_NETWORK', message: 'Không thể kết nối để tải hồ sơ cơ quan. Vui lòng thử lại.' });
}
async function load() {
  if (props.hostUnavailable) {
    setError(new PartnerApiError({ status: 503, code: 'HOST_ADAPTER_UNAVAILABLE', message: 'Native host chưa sẵn sàng. Ứng dụng không chuyển sang giao diện desktop thay thế.' }));
    return;
  }
  state.phase = 'loading'; state.error = null;
  try { state.detail = partnerDetailViewModel(await api.getDetail(props.partnerId)); state.phase = 'ready'; }
  catch (error) { setError(error); }
}
async function goBack() {
  if (isNative.value) { if (props.adapter) await props.adapter.goBack({ reason: 'partner-detail' }); return; }
  emit('back', state.detail?.listingHash || 'press');
}
function listenToHost() {
  if (!props.adapter || props.hostUnavailable) return;
  unsubscribers.push(props.adapter.subscribe(HostEvent.VIEWPORT, (payload) => { if (payload?.safeArea) safeArea.value = { ...safeArea.value, ...payload.safeArea }; }));
  unsubscribers.push(props.adapter.subscribe(HostEvent.LIFECYCLE, (payload) => { if (payload?.state === 'foreground') load(); }));
  unsubscribers.push(props.adapter.subscribe(HostEvent.DEEP_LINK, (payload) => { const match = /^\/?partner\/(\d+)$/.exec(String(payload?.path || '').replace(/^#/, '')); if (match) emit('navigate', Number(match[1])); }));
}
watch(() => props.partnerId, load);
onMounted(() => { listenToHost(); load(); });
onBeforeUnmount(() => { while (unsubscribers.length) unsubscribers.pop()(); });
</script>

<template>
  <div v-if="state.phase === 'loading'" :class="isNative ? 'mds-mobile-app grid h-[100dvh] place-items-center bg-[var(--mds-bg)]' : 'grid min-h-[360px] place-items-center bg-[var(--mds-bg-page)]'" :style="isNative ? safeAreaStyle : undefined"><MSpinner :size="28" class="text-[var(--mds-brand-600)]" /></div>
  <section v-else-if="state.phase === 'error'" :class="isNative ? 'mds-mobile-app min-h-[100dvh] bg-[var(--mds-bg)]' : 'min-h-[360px] bg-[var(--mds-bg-page)]'" :style="isNative ? safeAreaStyle : undefined"><MMobileTopBar v-if="isNative" title="Hồ sơ cơ quan" @back="goBack" /><MEmptyState :title="state.error.status === 404 ? 'Không tìm thấy cơ quan' : state.error.status === 403 ? 'Bạn không có quyền xem cơ quan này' : 'Không thể mở hồ sơ'" :description="state.error.message" /></section>
  <PartnerDetailPageMobile v-else-if="isNative" :detail="state.detail" :safe-area-style="safeAreaStyle" @back="goBack" @navigate="emit('navigate', $event)" />
  <PartnerDetailPage v-else :detail="state.detail" @back="goBack" @navigate="emit('navigate', $event)" />
</template>
