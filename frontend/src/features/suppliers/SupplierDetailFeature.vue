<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import MEmptyState from '../../components/mds/MEmptyState.vue';
import MMobileTopBar from '../../components/mds/MMobileTopBar.vue';
import MSpinner from '../../components/mds/MSpinner.vue';
import { HostEvent, HostSurface } from '../../platform/host-adapter.mjs';
import { createSupplierApi, SupplierApiError } from './domain/supplier-api.mjs';
import { supplierDetailViewModel } from './domain/supplier-detail.mjs';
import SupplierDetailPage from './desktop/SupplierDetailPage.vue';
import SupplierEditFormDesktop from './desktop/SupplierEditFormDesktop.vue';
import SupplierDetailPageMobile from './mobile/SupplierDetailPageMobile.vue';
import SupplierEditFormMobile from './mobile/SupplierEditFormMobile.vue';

const props = defineProps({ supplierId: { type: Number, required: true }, surface: { type: String, required: true }, adapter: { type: Object, default: null }, hostUnavailable: { type: Boolean, default: false } });
const emit = defineEmits(['back']);
const api = createSupplierApi();
const state = reactive({ phase: 'loading', detail: null, record: null, currentUser: null, permissions: null, error: null, mode: 'read', saving: false, saveError: null, uploading: false, fileError: null });
const safeArea = ref(props.adapter?.getSafeArea?.() || {});
const unsubscribers = [];
const isNative = computed(() => props.surface === HostSurface.NATIVE);
const safeAreaStyle = computed(() => Object.fromEntries(['top', 'right', 'bottom', 'left'].flatMap((side) => Number.isFinite(Number(safeArea.value?.[side])) ? [[`--mds-mobile-safe-${side}`, `${Number(safeArea.value[side])}px`]] : [])));

function setError(error) { state.phase = 'error'; state.error = error instanceof SupplierApiError ? error : new SupplierApiError({ status: 0, code: 'SUPPLIER_DETAIL_NETWORK', message: 'Không thể kết nối để tải hồ sơ nhà cung cấp. Vui lòng thử lại.' }); }
async function load() {
  if (props.hostUnavailable) { setError(new SupplierApiError({ status: 503, code: 'HOST_ADAPTER_UNAVAILABLE', message: 'Native host chưa sẵn sàng. Ứng dụng không chuyển sang giao diện desktop thay thế.' })); return; }
  state.phase = 'loading'; state.error = null;
  try { const [payload, session] = await Promise.all([api.getDetail(props.supplierId), api.getCurrentUser()]); state.record = payload.record; state.detail = supplierDetailViewModel(payload); state.currentUser = session?.user || null; state.permissions = session?.permissions || null; state.mode = 'read'; state.phase = 'ready'; } catch (error) { setError(error); }
}
const canEdit = computed(() => state.permissions?.modules?.suppliers?.includes('edit') === true);
async function saveEdit(payload) { state.saving = true; state.saveError = null; try { await api.update(props.supplierId, payload); await load(); } catch (error) { state.saveError = error instanceof SupplierApiError ? error.message : 'Không thể lưu nhà cung cấp. Vui lòng thử lại.'; } finally { state.saving = false; } }
const canUploadFiles = computed(() => state.permissions?.modules?.suppliers?.includes('edit') === true);
const canOpenFiles = computed(() => ['admin', 'super_admin'].includes(state.currentUser?.role));
async function uploadFiles(files) { state.uploading = true; state.fileError = null; try { await api.uploadFiles(props.supplierId, files); await load(); } catch (error) { state.fileError = error instanceof SupplierApiError ? error.message : 'Không thể tải tệp báo giá. Vui lòng thử lại.'; } finally { state.uploading = false; } }
async function goBack() { if (isNative.value) { if (props.adapter) await props.adapter.goBack({ reason: 'supplier-detail' }); return; } emit('back'); }
function listenToHost() {
  if (!props.adapter || props.hostUnavailable) return;
  unsubscribers.push(props.adapter.subscribe(HostEvent.VIEWPORT, (payload) => { if (payload?.safeArea) safeArea.value = { ...safeArea.value, ...payload.safeArea }; }));
  unsubscribers.push(props.adapter.subscribe(HostEvent.LIFECYCLE, (payload) => { if (payload?.state === 'foreground' && state.mode === 'read') load(); }));
  unsubscribers.push(props.adapter.subscribe(HostEvent.DEEP_LINK, (payload) => { if (/^\/?suppliers\/\d+$/.test(String(payload?.path || '').replace(/^#/, ''))) load(); }));
}
watch(() => props.supplierId, load);
onMounted(() => { listenToHost(); load(); });
onBeforeUnmount(() => { while (unsubscribers.length) unsubscribers.pop()(); });
</script>

<template>
  <div v-if="state.phase === 'loading'" :class="isNative ? 'mds-mobile-app grid h-[100dvh] place-items-center bg-[var(--mds-bg)]' : 'grid min-h-[360px] place-items-center bg-[var(--mds-bg-page)]'" :style="isNative ? safeAreaStyle : undefined"><MSpinner :size="28" class="text-[var(--mds-brand-600)]" /></div>
  <section v-else-if="state.phase === 'error'" :class="isNative ? 'mds-mobile-app min-h-[100dvh] bg-[var(--mds-bg)]' : 'min-h-[360px] bg-[var(--mds-bg-page)]'" :style="isNative ? safeAreaStyle : undefined"><MMobileTopBar v-if="isNative" title="Nhà cung cấp" @back="goBack" /><MEmptyState :title="state.error.status === 404 ? 'Không tìm thấy nhà cung cấp' : state.error.status === 403 ? 'Bạn không có quyền xem nhà cung cấp này' : 'Không thể mở hồ sơ'" :description="state.error.message" /></section>
  <SupplierEditFormMobile v-else-if="isNative && state.mode === 'edit'" :record="state.record" :saving="state.saving" :server-error="state.saveError" :safe-area-style="safeAreaStyle" @cancel="state.mode = 'read'" @save="saveEdit" />
  <SupplierDetailPageMobile v-else-if="isNative" :detail="state.detail" :can-edit="canEdit" :can-upload-files="canUploadFiles" :can-open-files="canOpenFiles" :uploading="state.uploading" :file-error="state.fileError" :safe-area-style="safeAreaStyle" @back="goBack" @edit="state.mode = 'edit'" @upload-files="uploadFiles" />
  <SupplierEditFormDesktop v-else-if="state.mode === 'edit'" :record="state.record" :saving="state.saving" :server-error="state.saveError" @cancel="state.mode = 'read'" @save="saveEdit" />
  <SupplierDetailPage v-else :detail="state.detail" :can-edit="canEdit" :can-upload-files="canUploadFiles" :can-open-files="canOpenFiles" :uploading="state.uploading" :file-error="state.fileError" @back="goBack" @edit="state.mode = 'edit'" @upload-files="uploadFiles" />
</template>
