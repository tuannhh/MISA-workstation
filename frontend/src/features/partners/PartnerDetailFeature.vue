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
import { createPartnerApi, PartnerApiError } from './domain/partner-api.mjs';
import { partnerDetailViewModel } from './domain/partner-detail.mjs';
import PartnerDetailPage from './desktop/PartnerDetailPage.vue';
import PartnerEditFormDesktop from './desktop/PartnerEditFormDesktop.vue';
import PartnerAgreementCreateDesktop from './desktop/PartnerAgreementCreateDesktop.vue';
import PartnerAgreementEditDesktop from './desktop/PartnerAgreementEditDesktop.vue';
import PartnerWorkLogCreateDesktop from './desktop/PartnerWorkLogCreateDesktop.vue';
import PartnerWorkLogEditDesktop from './desktop/PartnerWorkLogEditDesktop.vue';
import PartnerAgreementCreateMobile from './mobile/PartnerAgreementCreateMobile.vue';
import PartnerAgreementEditMobile from './mobile/PartnerAgreementEditMobile.vue';
import PartnerEditFormMobile from './mobile/PartnerEditFormMobile.vue';
import PartnerDetailPageMobile from './mobile/PartnerDetailPageMobile.vue';
import PartnerWorkLogCreateMobile from './mobile/PartnerWorkLogCreateMobile.vue';
import PartnerWorkLogEditMobile from './mobile/PartnerWorkLogEditMobile.vue';

const props = defineProps({ partnerId: { type: Number, required: true }, surface: { type: String, required: true }, adapter: { type: Object, default: null }, hostUnavailable: { type: Boolean, default: false } });
const emit = defineEmits(['back', 'navigate']);
const api = createPartnerApi();
const state = reactive({ phase: 'loading', detail: null, record: null, currentUser: null, permissions: null, editingAgreement: null, editingWorkLog: null, ownerReassign: null, ownerReassignContext: null, ownerId: null, ownerReassignTarget: null, ownerReassignSaving: false, ownerReassignError: '', error: null, mode: 'read', saving: false, saveError: null, deleting: false, deleteError: null, deletingCooperationId: null, cooperationDeleteError: null, uploadingCooperationId: null, fileError: null });
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
  try { const [payload, session] = await Promise.all([api.getDetail(props.partnerId), api.getCurrentUser()]); state.record = payload.record; state.detail = partnerDetailViewModel(payload); state.currentUser = session?.user || null; state.permissions = session?.permissions || null; state.mode = 'read'; state.phase = 'ready'; }
  catch (error) { setError(error); }
}
const canEdit = computed(() => state.permissions?.modules?.partners?.includes('edit') === true);
const canDelete = computed(() => state.permissions?.modules?.partners?.includes('delete') === true && ['admin', 'super_admin'].includes(state.permissions?.role));
const canCreateCooperation = computed(() => state.detail?.type === 'gov' && state.permissions?.modules?.partners?.includes('create') === true);
const canReassignCooperation = computed(() => (item) => Boolean(item?.id) && state.permissions?.modules?.admin?.includes('edit') === true);
function canEditCooperation(item) { return state.detail?.type === 'gov' && state.permissions?.modules?.partners?.includes('edit') === true && (['admin', 'super_admin'].includes(state.currentUser?.role) || (state.currentUser?.role === 'executor' && Number(item?.ownerId) === Number(state.currentUser?.id))); }
async function saveEdit(payload) { state.saving = true; state.saveError = null; try { await api.update(props.partnerId, payload); await load(); } catch (error) { state.saveError = error instanceof PartnerApiError ? error.message : 'Không thể lưu cơ quan. Vui lòng thử lại.'; } finally { state.saving = false; } }
async function saveAgreement(payload) { state.saving = true; state.saveError = null; try { await api.createAgreement(props.partnerId, payload); await load(); } catch (error) { state.saveError = error instanceof PartnerApiError ? error.message : 'Không thể lưu thỏa thuận. Vui lòng thử lại.'; } finally { state.saving = false; } }
function beginAgreementEdit(agreement) { state.editingAgreement = agreement; state.saveError = null; state.mode = 'agreement-edit'; }
async function saveAgreementEdit(payload) { if (!state.editingAgreement) return; state.saving = true; state.saveError = null; try { await api.updateAgreement(state.editingAgreement.id, payload); await load(); } catch (error) { state.saveError = error instanceof PartnerApiError ? error.message : 'Không thể cập nhật thỏa thuận. Vui lòng thử lại.'; } finally { state.saving = false; } }
function beginWorkLogEdit(workLog) { state.editingWorkLog = workLog; state.saveError = null; state.mode = 'work-log-edit'; }
const OWNER_RESOURCE_LABEL = Object.freeze({ agreement: 'Thỏa thuận / MOU', work_log: 'Lịch sử làm việc', sponsorship: 'Tài trợ / giải thưởng', gift: 'Quà tặng đối ngoại', association_fee: 'Hội phí', benefit_usage: 'Quyền lợi hợp đồng' });
async function beginOwnerReassign(entity, record) { if (!Object.hasOwn(OWNER_RESOURCE_LABEL, entity) || !canReassignCooperation.value(record)) return; state.ownerReassignError = ''; state.ownerReassignTarget = null; const projectedRecord = entity === 'gift' ? { responsible_user_id: record.ownerId } : { owner_id: record.ownerId }; try { state.ownerReassign = ownerReassignViewModel({ record: projectedRecord, users: await api.getAdminUsers() }); state.ownerReassignContext = { entity, id: Number(record.id), title: record.title, resourceLabel: OWNER_RESOURCE_LABEL[entity] }; state.ownerId = state.ownerReassign.ownerId; state.mode = 'owner-reassign'; } catch (error) { state.ownerReassignError = error.message; state.ownerReassignContext = { entity, id: Number(record?.id), title: record?.title, resourceLabel: OWNER_RESOURCE_LABEL[entity] }; state.mode = 'owner-reassign'; } }
function requestOwnerReassign() { try { const nextOwner = toOwnerReassignPayload(state.ownerId).owner_id; if (nextOwner === state.ownerReassign?.ownerId) throw new TypeError('Hãy chọn người phụ trách khác người hiện tại.'); state.ownerReassignTarget = state.ownerReassign?.owners.find((option) => option.value === nextOwner) || null; } catch (error) { state.ownerReassignError = error.message; } }
async function saveOwnerReassign() { const target = state.ownerReassignTarget; const context = state.ownerReassignContext; if (!target || !context?.entity || !context?.id) return; state.ownerReassignSaving = true; state.ownerReassignError = ''; try { await api.reassignOwner(context.entity, context.id, toOwnerReassignPayload(target.value).owner_id); state.ownerReassignTarget = null; await load(); } catch (error) { state.ownerReassignError = error.message; state.ownerReassignTarget = null; } finally { state.ownerReassignSaving = false; } }
function cancelOwnerReassign() { state.ownerReassignTarget = null; state.ownerReassignError = ''; state.ownerReassignContext = null; state.mode = 'read'; }
async function saveWorkLogEdit(payload) { if (!state.editingWorkLog) return; state.saving = true; state.saveError = null; try { await api.updateWorkLog(state.editingWorkLog.id, payload); await load(); } catch (error) { state.saveError = error instanceof PartnerApiError ? error.message : 'Không thể cập nhật lịch sử làm việc. Vui lòng thử lại.'; } finally { state.saving = false; } }
async function saveWorkLog(payload) { state.saving = true; state.saveError = null; try { await api.createWorkLog(props.partnerId, payload); await load(); } catch (error) { state.saveError = error instanceof PartnerApiError ? error.message : 'Không thể lưu lịch sử làm việc. Vui lòng thử lại.'; } finally { state.saving = false; } }
async function deleteAgreement(agreementId) { state.deletingCooperationId = agreementId; state.cooperationDeleteError = null; try { await api.deleteAgreement(agreementId); await load(); } catch (error) { state.cooperationDeleteError = error instanceof PartnerApiError ? error.message : 'Không thể xóa thỏa thuận. Vui lòng thử lại.'; } finally { state.deletingCooperationId = null; } }
async function deleteWorkLog(workLogId) { state.deletingCooperationId = workLogId; state.cooperationDeleteError = null; try { await api.deleteWorkLog(workLogId); await load(); } catch (error) { state.cooperationDeleteError = error instanceof PartnerApiError ? error.message : 'Không thể xóa lịch sử làm việc. Vui lòng thử lại.'; } finally { state.deletingCooperationId = null; } }
async function uploadAgreementFiles({ id, files }) { state.uploadingCooperationId = id; state.fileError = null; try { await api.uploadAgreementFiles(id, files); await load(); } catch (error) { state.fileError = error instanceof PartnerApiError ? error.message : 'Không thể tải tệp MOU. Vui lòng thử lại.'; } finally { state.uploadingCooperationId = null; } }
async function uploadWorkLogFiles({ id, files }) { state.uploadingCooperationId = id; state.fileError = null; try { await api.uploadWorkLogFiles(id, files); await load(); } catch (error) { state.fileError = error instanceof PartnerApiError ? error.message : 'Không thể tải tệp lịch sử. Vui lòng thử lại.'; } finally { state.uploadingCooperationId = null; } }
async function deletePartner() { state.deleting = true; state.deleteError = null; try { await api.deletePartner(props.partnerId); await goBack(); } catch (error) { state.deleteError = error instanceof PartnerApiError ? error.message : 'Không thể xóa cơ quan. Vui lòng thử lại.'; } finally { state.deleting = false; } }
async function goBack() {
  if (isNative.value) { if (props.adapter) await props.adapter.goBack({ reason: 'partner-detail' }); return; }
  emit('back', state.detail?.listingHash || 'press');
}
function listenToHost() {
  if (!props.adapter || props.hostUnavailable) return;
  unsubscribers.push(props.adapter.subscribe(HostEvent.VIEWPORT, (payload) => { if (payload?.safeArea) safeArea.value = { ...safeArea.value, ...payload.safeArea }; }));
  unsubscribers.push(props.adapter.subscribe(HostEvent.LIFECYCLE, (payload) => { if (payload?.state === 'foreground' && state.mode === 'read') load(); }));
  unsubscribers.push(props.adapter.subscribe(HostEvent.DEEP_LINK, (payload) => { const match = /^\/?partner\/(\d+)$/.exec(String(payload?.path || '').replace(/^#/, '')); if (match) emit('navigate', Number(match[1])); }));
}
watch(() => props.partnerId, load);
onMounted(() => { listenToHost(); load(); });
onBeforeUnmount(() => { while (unsubscribers.length) unsubscribers.pop()(); });
</script>

<template>
  <div v-if="state.phase === 'loading'" :class="isNative ? 'mds-mobile-app grid h-[100dvh] place-items-center bg-[var(--mds-bg)]' : 'grid min-h-[360px] place-items-center bg-[var(--mds-bg-page)]'" :style="isNative ? safeAreaStyle : undefined"><MSpinner :size="28" class="text-[var(--mds-brand-600)]" /></div>
  <section v-else-if="state.phase === 'error'" :class="isNative ? 'mds-mobile-app min-h-[100dvh] bg-[var(--mds-bg)]' : 'min-h-[360px] bg-[var(--mds-bg-page)]'" :style="isNative ? safeAreaStyle : undefined"><MMobileTopBar v-if="isNative" title="Hồ sơ cơ quan" @back="goBack" /><MEmptyState :title="state.error.status === 404 ? 'Không tìm thấy cơ quan' : state.error.status === 403 ? 'Bạn không có quyền xem cơ quan này' : 'Không thể mở hồ sơ'" :description="state.error.message" /></section>
  <OwnerReassignMobile v-else-if="isNative && state.mode === 'owner-reassign'" :resource-label="state.ownerReassignContext?.resourceLabel" :title="state.ownerReassignContext?.title" :current-owner-label="state.ownerReassign?.currentOwnerLabel" :current-owner-id="state.ownerReassign?.ownerId" :owners="state.ownerReassign?.owners" :owner-id="state.ownerId" :saving="state.ownerReassignSaving" :error="state.ownerReassignError" :safe-area-style="safeAreaStyle" @back="cancelOwnerReassign" @update:owner-id="state.ownerId=$event" @submit="requestOwnerReassign" />
  <PartnerEditFormMobile v-else-if="isNative && state.mode === 'edit'" :record="state.record" :saving="state.saving" :server-error="state.saveError" :safe-area-style="safeAreaStyle" @cancel="state.mode = 'read'" @save="saveEdit" />
  <PartnerAgreementCreateMobile v-else-if="isNative && state.mode === 'agreement-create'" :saving="state.saving" :server-error="state.saveError" :safe-area-style="safeAreaStyle" @cancel="state.mode = 'read'" @save="saveAgreement" />
  <PartnerAgreementEditMobile v-else-if="isNative && state.mode === 'agreement-edit'" :record="state.editingAgreement" :saving="state.saving" :server-error="state.saveError" :safe-area-style="safeAreaStyle" @cancel="state.mode = 'read'" @save="saveAgreementEdit" />
  <PartnerWorkLogCreateMobile v-else-if="isNative && state.mode === 'work-log-create'" :saving="state.saving" :server-error="state.saveError" :safe-area-style="safeAreaStyle" @cancel="state.mode = 'read'" @save="saveWorkLog" />
  <PartnerWorkLogEditMobile v-else-if="isNative && state.mode === 'work-log-edit'" :record="state.editingWorkLog" :saving="state.saving" :server-error="state.saveError" :safe-area-style="safeAreaStyle" @cancel="state.mode = 'read'" @save="saveWorkLogEdit" />
  <PartnerDetailPageMobile v-else-if="isNative" :detail="state.detail" :can-edit="canEdit" :can-delete="canDelete" :can-create-cooperation="canCreateCooperation" :can-edit-cooperation="canEditCooperation" :can-reassign-cooperation="canReassignCooperation" :can-upload-cooperation="canEditCooperation" :can-delete-cooperation="canDelete" :deleting-cooperation-id="state.deletingCooperationId" :uploading-cooperation-id="state.uploadingCooperationId" :cooperation-delete-error="state.cooperationDeleteError" :file-error="state.fileError" :delete-working="state.deleting" :delete-error="state.deleteError" :safe-area-style="safeAreaStyle" @back="goBack" @edit="state.mode = 'edit'" @create-agreement="state.mode = 'agreement-create'" @create-work-log="state.mode = 'work-log-create'" @edit-agreement="beginAgreementEdit" @edit-work-log="beginWorkLogEdit" @reassign-agreement="beginOwnerReassign('agreement', $event)" @reassign-work-log="beginOwnerReassign('work_log', $event)" @reassign-direct="beginOwnerReassign($event.entity, $event.record)" @upload-agreement="uploadAgreementFiles" @upload-work-log="uploadWorkLogFiles" @delete-agreement="deleteAgreement" @delete-work-log="deleteWorkLog" @delete-partner="deletePartner" @navigate="emit('navigate', $event)" />
  <OwnerReassignDesktop v-else-if="state.mode === 'owner-reassign'" :resource-label="state.ownerReassignContext?.resourceLabel" :title="state.ownerReassignContext?.title" :current-owner-label="state.ownerReassign?.currentOwnerLabel" :current-owner-id="state.ownerReassign?.ownerId" :owners="state.ownerReassign?.owners" :owner-id="state.ownerId" :saving="state.ownerReassignSaving" :error="state.ownerReassignError" @back="cancelOwnerReassign" @update:owner-id="state.ownerId=$event" @submit="requestOwnerReassign" />
  <PartnerEditFormDesktop v-else-if="state.mode === 'edit'" :record="state.record" :saving="state.saving" :server-error="state.saveError" @cancel="state.mode = 'read'" @save="saveEdit" />
  <PartnerAgreementCreateDesktop v-else-if="state.mode === 'agreement-create'" :saving="state.saving" :server-error="state.saveError" @cancel="state.mode = 'read'" @save="saveAgreement" />
  <PartnerAgreementEditDesktop v-else-if="state.mode === 'agreement-edit'" :record="state.editingAgreement" :saving="state.saving" :server-error="state.saveError" @cancel="state.mode = 'read'" @save="saveAgreementEdit" />
  <PartnerWorkLogCreateDesktop v-else-if="state.mode === 'work-log-create'" :saving="state.saving" :server-error="state.saveError" @cancel="state.mode = 'read'" @save="saveWorkLog" />
  <PartnerWorkLogEditDesktop v-else-if="state.mode === 'work-log-edit'" :record="state.editingWorkLog" :saving="state.saving" :server-error="state.saveError" @cancel="state.mode = 'read'" @save="saveWorkLogEdit" />
  <PartnerDetailPage v-else :detail="state.detail" :can-edit="canEdit" :can-delete="canDelete" :can-create-cooperation="canCreateCooperation" :can-edit-cooperation="canEditCooperation" :can-reassign-cooperation="canReassignCooperation" :can-upload-cooperation="canEditCooperation" :can-delete-cooperation="canDelete" :deleting-cooperation-id="state.deletingCooperationId" :uploading-cooperation-id="state.uploadingCooperationId" :cooperation-delete-error="state.cooperationDeleteError" :file-error="state.fileError" :delete-working="state.deleting" :delete-error="state.deleteError" @back="goBack" @edit="state.mode = 'edit'" @create-agreement="state.mode = 'agreement-create'" @create-work-log="state.mode = 'work-log-create'" @edit-agreement="beginAgreementEdit" @edit-work-log="beginWorkLogEdit" @reassign-agreement="beginOwnerReassign('agreement', $event)" @reassign-work-log="beginOwnerReassign('work_log', $event)" @reassign-direct="beginOwnerReassign($event.entity, $event.record)" @upload-agreement="uploadAgreementFiles" @upload-work-log="uploadWorkLogFiles" @delete-agreement="deleteAgreement" @delete-work-log="deleteWorkLog" @delete-partner="deletePartner" @navigate="emit('navigate', $event)" />
  <MDialog :model-value="Boolean(state.ownerReassignTarget)" title="Xác nhận gán lại người phụ trách?" type="danger" confirm-text="Gán lại" @update:model-value="!$event&&(state.ownerReassignTarget=null)" @confirm="saveOwnerReassign"><p>{{ state.ownerReassignContext?.resourceLabel }} sẽ được gán cho <strong>{{ state.ownerReassignTarget?.label }}</strong>. Máy chủ sẽ kiểm tra lại quyền Admin và trạng thái tài khoản trước khi lưu.</p></MDialog>
</template>
