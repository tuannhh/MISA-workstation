<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import MDialog from '../../components/mds/MDialog.vue';
import MEmptyState from '../../components/mds/MEmptyState.vue';
import MMobileTopBar from '../../components/mds/MMobileTopBar.vue';
import MSpinner from '../../components/mds/MSpinner.vue';
import { HostEvent, HostSurface } from '../../platform/host-adapter.mjs';
import { ownerReassignViewModel, toOwnerReassignPayload } from '../ownership/domain/owner-reassign.mjs';
import OwnerReassignDesktop from '../ownership/desktop/OwnerReassignDesktop.vue';
import OwnerReassignMobile from '../ownership/mobile/OwnerReassignMobile.vue';
import { createSupplierApi, SupplierApiError } from './domain/supplier-api.mjs';
import { supplierDetailViewModel } from './domain/supplier-detail.mjs';
import SupplierDetailPage from './desktop/SupplierDetailPage.vue';
import SupplierEditFormDesktop from './desktop/SupplierEditFormDesktop.vue';
import SupplierDetailPageMobile from './mobile/SupplierDetailPageMobile.vue';
import SupplierEditFormMobile from './mobile/SupplierEditFormMobile.vue';
import SupplierDirectFormDesktop from './desktop/SupplierDirectFormDesktop.vue';
import SupplierDirectFormMobile from './mobile/SupplierDirectFormMobile.vue';

const props = defineProps({ supplierId: { type: Number, required: true }, surface: { type: String, required: true }, adapter: { type: Object, default: null }, hostUnavailable: { type: Boolean, default: false } });
const emit = defineEmits(['back']);
const api = createSupplierApi();
const state = reactive({ phase: 'loading', detail: null, record: null, currentUser: null, permissions: null, directKind: null, directRecord: null, directDeleteTarget: null, ownerReassign: null, ownerReassignContext: null, ownerId: null, ownerReassignTarget: null, ownerReassignSaving: false, ownerReassignError: '', error: null, mode: 'read', saving: false, saveError: null, uploading: false, fileError: null });
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
const canCreateDirect = computed(() => state.permissions?.modules?.suppliers?.includes('create') === true);
const canDeleteDirect = computed(() => state.permissions?.modules?.suppliers?.includes('delete') === true && ['admin', 'super_admin'].includes(state.currentUser?.role));
const canSeeMoney = computed(() => ['admin', 'super_admin'].includes(state.currentUser?.role));
function canEditDirect(record) { return canEdit.value && (['admin', 'super_admin'].includes(state.currentUser?.role) || (state.currentUser?.role === 'executor' && Number(record?.ownerId) === Number(state.currentUser?.id))); }
const canReassign = computed(() => (record) => Boolean(record?.id) && state.permissions?.modules?.admin?.includes('edit') === true);
async function saveEdit(payload) { state.saving = true; state.saveError = null; try { await api.update(props.supplierId, payload); await load(); } catch (error) { state.saveError = error instanceof SupplierApiError ? error.message : 'Không thể lưu nhà cung cấp. Vui lòng thử lại.'; } finally { state.saving = false; } }
const canUploadFiles = computed(() => state.permissions?.modules?.suppliers?.includes('edit') === true);
const canOpenFiles = computed(() => ['admin', 'super_admin'].includes(state.currentUser?.role));
async function uploadFiles(files) { state.uploading = true; state.fileError = null; try { await api.uploadFiles(props.supplierId, files); await load(); } catch (error) { state.fileError = error instanceof SupplierApiError ? error.message : 'Không thể tải tệp báo giá. Vui lòng thử lại.'; } finally { state.uploading = false; } }
function beginDirect(kind, record = null) { if (record ? !canEditDirect(record) || kind === 'quote' : !canCreateDirect.value) return; state.directKind = kind; state.directRecord = record; state.saveError = null; state.mode = 'direct-form'; }
async function saveDirect(payload) { if (!state.directKind || (state.directRecord ? !canEditDirect(state.directRecord) : !canCreateDirect.value)) return; state.saving = true; state.saveError = null; try { await api.saveDirect(props.supplierId, state.directKind, payload, state.directRecord?.id); await load(); } catch (error) { state.saveError = error instanceof SupplierApiError ? error.message : 'Không thể lưu bản ghi nhà cung cấp. Vui lòng thử lại.'; } finally { state.saving = false; } }
function askDeleteDirect({ kind, record }) { if (canDeleteDirect.value && record?.id) state.directDeleteTarget = { kind, record }; }
async function deleteDirect() { const target = state.directDeleteTarget; if (!canDeleteDirect.value || !target?.record?.id) return; state.directDeleteTarget = null; state.saveError = null; try { await api.deleteDirect(props.supplierId, target.kind, target.record.id); await load(); } catch (error) { state.saveError = error instanceof SupplierApiError ? error.message : 'Không thể xóa bản ghi nhà cung cấp. Vui lòng thử lại.'; } }
async function beginOwnerReassign({ entity, record, label }) {
  if (!canReassign.value(record)) return;
  const context = { entity, id: Number(record.id), title: record.title || record.item || record.name || `Bản ghi #${record.id}`, resourceLabel: label };
  state.ownerReassignError = ''; state.ownerReassignTarget = null; state.ownerReassignContext = context;
  try { state.ownerReassign = ownerReassignViewModel({ record: { owner_id: record.ownerId }, users: await api.getAdminUsers() }); state.ownerId = state.ownerReassign.ownerId; state.mode = 'owner-reassign'; }
  catch (error) { state.ownerReassignError = error.message; state.mode = 'owner-reassign'; }
}
function requestOwnerReassign() {
  try {
    const nextOwner = toOwnerReassignPayload(state.ownerId).owner_id;
    if (nextOwner === state.ownerReassign?.ownerId) throw new TypeError('Hãy chọn người phụ trách khác người hiện tại.');
    state.ownerReassignTarget = state.ownerReassign?.owners.find((option) => option.value === nextOwner) || null;
  } catch (error) { state.ownerReassignError = error.message; }
}
async function saveOwnerReassign() {
  const target = state.ownerReassignTarget; const context = state.ownerReassignContext;
  if (!target || !context?.entity || !context?.id) return;
  state.ownerReassignSaving = true; state.ownerReassignError = '';
  try { await api.reassignOwner(context.entity, context.id, toOwnerReassignPayload(target.value).owner_id); state.ownerReassignTarget = null; await load(); }
  catch (error) { state.ownerReassignError = error.message; state.ownerReassignTarget = null; }
  finally { state.ownerReassignSaving = false; }
}
function cancelOwnerReassign() { state.ownerReassignTarget = null; state.ownerReassignError = ''; state.ownerReassignContext = null; state.mode = 'read'; }
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
  <OwnerReassignMobile v-else-if="isNative && state.mode === 'owner-reassign'" :resource-label="state.ownerReassignContext?.resourceLabel" :title="state.ownerReassignContext?.title" :current-owner-label="state.ownerReassign?.currentOwnerLabel" :current-owner-id="state.ownerReassign?.ownerId" :owners="state.ownerReassign?.owners" :owner-id="state.ownerId" :saving="state.ownerReassignSaving" :error="state.ownerReassignError" :safe-area-style="safeAreaStyle" @back="cancelOwnerReassign" @update:owner-id="state.ownerId=$event" @submit="requestOwnerReassign" />
  <SupplierEditFormMobile v-else-if="isNative && state.mode === 'edit'" :record="state.record" :saving="state.saving" :server-error="state.saveError" :safe-area-style="safeAreaStyle" @cancel="state.mode = 'read'" @save="saveEdit" />
  <SupplierDirectFormMobile v-else-if="isNative&&state.mode==='direct-form'" :kind="state.directKind" :record="state.directRecord" :can-see-money="canSeeMoney" :saving="state.saving" :error="state.saveError" :safe-area-style="safeAreaStyle" @back="state.mode='read'" @save="saveDirect" @local-error="state.saveError=$event" />
  <SupplierDetailPageMobile v-else-if="isNative" :detail="state.detail" :can-edit="canEdit" :can-create-direct="canCreateDirect" :can-edit-direct="canEditDirect" :can-delete-direct="canDeleteDirect" :can-reassign="canReassign" :can-upload-files="canUploadFiles" :can-open-files="canOpenFiles" :uploading="state.uploading" :file-error="state.fileError" :safe-area-style="safeAreaStyle" @back="goBack" @edit="state.mode = 'edit'" @create-direct="beginDirect($event)" @edit-direct="beginDirect($event.kind,$event.record)" @delete-direct="askDeleteDirect" @reassign="beginOwnerReassign" @upload-files="uploadFiles" />
  <OwnerReassignDesktop v-else-if="state.mode === 'owner-reassign'" :resource-label="state.ownerReassignContext?.resourceLabel" :title="state.ownerReassignContext?.title" :current-owner-label="state.ownerReassign?.currentOwnerLabel" :current-owner-id="state.ownerReassign?.ownerId" :owners="state.ownerReassign?.owners" :owner-id="state.ownerId" :saving="state.ownerReassignSaving" :error="state.ownerReassignError" @back="cancelOwnerReassign" @update:owner-id="state.ownerId=$event" @submit="requestOwnerReassign" />
  <SupplierEditFormDesktop v-else-if="state.mode === 'edit'" :record="state.record" :saving="state.saving" :server-error="state.saveError" @cancel="state.mode = 'read'" @save="saveEdit" />
  <SupplierDirectFormDesktop v-else-if="state.mode==='direct-form'" :kind="state.directKind" :record="state.directRecord" :can-see-money="canSeeMoney" :saving="state.saving" :error="state.saveError" @back="state.mode='read'" @save="saveDirect" @local-error="state.saveError=$event" />
  <SupplierDetailPage v-else :detail="state.detail" :can-edit="canEdit" :can-create-direct="canCreateDirect" :can-edit-direct="canEditDirect" :can-delete-direct="canDeleteDirect" :can-reassign="canReassign" :can-upload-files="canUploadFiles" :can-open-files="canOpenFiles" :uploading="state.uploading" :file-error="state.fileError" @back="goBack" @edit="state.mode = 'edit'" @create-direct="beginDirect($event)" @edit-direct="beginDirect($event.kind,$event.record)" @delete-direct="askDeleteDirect" @reassign="beginOwnerReassign" @upload-files="uploadFiles" />
  <MDialog :model-value="Boolean(state.ownerReassignTarget)" title="Xác nhận gán lại người phụ trách?" type="danger" confirm-text="Gán lại" @update:model-value="!$event&&(state.ownerReassignTarget=null)" @confirm="saveOwnerReassign"><p>{{ state.ownerReassignContext?.resourceLabel }} sẽ được gán cho <strong>{{ state.ownerReassignTarget?.label }}</strong>. Máy chủ sẽ kiểm tra lại quyền Admin và trạng thái tài khoản trước khi lưu.</p></MDialog>
  <MDialog :model-value="Boolean(state.directDeleteTarget)" title="Xóa bản ghi nhà cung cấp?" type="danger" confirm-text="Xóa" @update:model-value="!$event&&(state.directDeleteTarget=null)" @confirm="deleteDirect"><p>Bản ghi “{{state.directDeleteTarget?.record?.title||state.directDeleteTarget?.record?.name||state.directDeleteTarget?.record?.item}}” sẽ bị xóa. Máy chủ kiểm tra lại quyền trước khi thực hiện.</p></MDialog>
</template>
