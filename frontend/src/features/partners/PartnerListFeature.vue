<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import MEmptyState from '../../components/mds/MEmptyState.vue';
import MMobileTopBar from '../../components/mds/MMobileTopBar.vue';
import MSpinner from '../../components/mds/MSpinner.vue';
import { HostEvent, HostSurface } from '../../platform/host-adapter.mjs';
import { createPartnerApi, PartnerApiError } from './domain/partner-api.mjs';
import { partnerListViewModel } from './domain/partner-list.mjs';
import PartnerListDesktop from './desktop/PartnerListDesktop.vue';
import PartnerCreateDesktop from './desktop/PartnerCreateDesktop.vue';
import PartnerListMobile from './mobile/PartnerListMobile.vue';
import PartnerCreateMobile from './mobile/PartnerCreateMobile.vue';

const props = defineProps({ type: { type: String, required: true }, surface: { type: String, required: true }, adapter: { type: Object, default: null }, hostUnavailable: { type: Boolean, default: false }, nativeNavigation: { type: Array, default: () => [] } });
const emit = defineEmits(['back', 'open', 'change-type', 'navigate']);
const api = createPartnerApi(); const unsubscribers = []; const safeArea = ref(props.adapter?.getSafeArea?.() || {});
const state = reactive({ phase: 'loading', type: props.type, rows: [], total: 0, page: 1, pageSize: 20, search: '', permissions: null, mode: 'read', creating: false, createError: '', error: null });
const isNative = computed(() => props.surface === HostSurface.NATIVE); const canCreate = computed(() => state.permissions?.modules?.partners?.includes('create') === true);
const safeAreaStyle = computed(() => Object.fromEntries(['top', 'right', 'bottom', 'left'].flatMap((side) => Number.isFinite(Number(safeArea.value?.[side])) ? [[`--mds-mobile-safe-${side}`, `${Number(safeArea.value[side])}px`]] : [])));
function setError(error) { state.error = error instanceof PartnerApiError ? error : new PartnerApiError({ status: 0, code: 'PARTNER_LIST_NETWORK', message: 'Không thể tải danh sách cơ quan. Vui lòng thử lại.' }); state.phase = 'error'; }
async function load({ type = state.type, page = state.page, search = state.search } = {}) { if (props.hostUnavailable) { setError(new PartnerApiError({ status: 503, code: 'HOST_ADAPTER_UNAVAILABLE', message: 'Native host chưa sẵn sàng. Ứng dụng không chuyển sang giao diện desktop thay thế.' })); return; } state.phase = 'loading'; state.error = null; try { const [payload, session] = await Promise.all([api.getList({ type, page, pageSize: state.pageSize, search }), api.getCurrentUser()]); const model = partnerListViewModel(payload, type); state.type = model.type; state.rows = model.rows; state.total = model.total; state.page = model.page; state.pageSize = model.pageSize; state.search = search; state.permissions = session?.permissions || null; state.mode = 'read'; state.phase = 'ready'; } catch (error) { setError(error); } }
function search(value) { load({ page: 1, search: value }); }
function changePage(page) { load({ page, search: state.search }); }
function changeType(type) { if (type === state.type) return; emit('change-type', type); }
function beginCreate() { if (canCreate.value) { state.createError = ''; state.mode = 'create'; } }
async function createPartner(input) { state.creating = true; state.createError = ''; try { const result = await api.createPartner(input); emit('open', result.id); } catch (error) { state.createError = error instanceof PartnerApiError ? error.message : 'Không thể tạo cơ quan. Vui lòng thử lại.'; } finally { state.creating = false; } }
async function goBack() { if (isNative.value && props.adapter) { await props.adapter.goBack({ reason: 'partner-list' }); return; } emit('back'); }
function listenToHost() { if (!props.adapter || props.hostUnavailable) return; unsubscribers.push(props.adapter.subscribe(HostEvent.VIEWPORT, (payload) => { if (payload?.safeArea) safeArea.value = { ...safeArea.value, ...payload.safeArea }; })); unsubscribers.push(props.adapter.subscribe(HostEvent.LIFECYCLE, (payload) => { if (payload?.state === 'foreground') load(); })); }
watch(() => props.type, (type) => load({ type, page: 1, search: '' })); onMounted(() => { listenToHost(); load({ type: props.type }); }); onBeforeUnmount(() => { while (unsubscribers.length) unsubscribers.pop()(); });
</script>

<template><div v-if="state.phase === 'loading'" :class="isNative ? 'mds-mobile-app grid h-[100dvh] place-items-center bg-[var(--mds-bg)]' : 'grid min-h-[360px] place-items-center bg-[var(--mds-bg-page)]'" :style="isNative ? safeAreaStyle : undefined"><MSpinner :size="28" /></div><section v-else-if="state.phase === 'error'" :class="isNative ? 'mds-mobile-app min-h-[100dvh] bg-[var(--mds-bg)]' : 'min-h-[360px] bg-[var(--mds-bg-page)]'" :style="isNative ? safeAreaStyle : undefined"><MMobileTopBar v-if="isNative" title="Cơ quan đối tác" @back="goBack"/><MEmptyState :title="state.error.status === 403 ? 'Bạn không có quyền xem cơ quan' : 'Không thể mở danh sách cơ quan'" :description="state.error.message"/></section><PartnerCreateMobile v-else-if="isNative && state.mode === 'create'" :type="state.type" :saving="state.creating" :server-error="state.createError" :safe-area-style="safeAreaStyle" @cancel="state.mode = 'read'" @save="createPartner"/><PartnerListMobile v-else-if="isNative" :type="state.type" :rows="state.rows" :total="state.total" :page="state.page" :page-size="state.pageSize" :search="state.search" :can-create="canCreate" :safe-area-style="safeAreaStyle" :native-navigation="nativeNavigation" @back="goBack" @search="search" @page="changePage" @open="emit('open', $event)" @create="beginCreate" @change-type="changeType" @navigate="emit('navigate', $event)"/><PartnerCreateDesktop v-else-if="state.mode === 'create'" :type="state.type" :saving="state.creating" :server-error="state.createError" @cancel="state.mode = 'read'" @save="createPartner"/><PartnerListDesktop v-else :type="state.type" :rows="state.rows" :total="state.total" :page="state.page" :page-size="state.pageSize" :search="state.search" :can-create="canCreate" @search="search" @page="changePage" @open="emit('open', $event)" @create="beginCreate" @change-type="changeType"/></template>
