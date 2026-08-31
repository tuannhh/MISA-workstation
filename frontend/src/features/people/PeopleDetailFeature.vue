<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import MEmptyState from '../../components/mds/MEmptyState.vue';
import MMobileTopBar from '../../components/mds/MMobileTopBar.vue';
import MSpinner from '../../components/mds/MSpinner.vue';
import { HostEvent, HostSurface } from '../../platform/host-adapter.mjs';
import { createPeopleApi, PeopleApiError } from './domain/people-api.mjs';
import { peopleDetailViewModel } from './domain/people-detail.mjs';
import PeopleDetailPage from './desktop/PeopleDetailPage.vue';
import PeopleEditFormDesktop from './desktop/PeopleEditFormDesktop.vue';
import PeopleEditFormMobile from './mobile/PeopleEditFormMobile.vue';
import PeopleDetailPageMobile from './mobile/PeopleDetailPageMobile.vue';
import PeopleAttachmentsPanel from './PeopleAttachmentsPanel.vue';

const props = defineProps({ personId: { type: Number, required: true }, surface: { type: String, required: true }, adapter: { type: Object, default: null }, hostUnavailable: { type: Boolean, default: false } });
const emit = defineEmits(['back', 'navigate']);
const api = createPeopleApi();
const state = reactive({ phase: 'loading', detail: null, record: null, permissions: null, error: null, mode: 'read', saving: false, saveError: null, attachmentWorking: false, attachmentError: null });
const safeArea = ref(props.adapter?.getSafeArea?.() || {});
const unsubscribers = [];
const isNative = computed(() => props.surface === HostSurface.NATIVE);
const canEdit = computed(() => state.permissions?.modules?.partners?.includes('edit') === true);
const canManageIdDocs = computed(() => state.permissions?.canSeeSensitive === true);
const safeAreaStyle = computed(() => Object.fromEntries(['top', 'right', 'bottom', 'left'].flatMap((side) => Number.isFinite(Number(safeArea.value?.[side])) ? [[`--mds-mobile-safe-${side}`, `${Number(safeArea.value[side])}px`]] : [])));

function setError(error) { state.phase = 'error'; state.error = error instanceof PeopleApiError ? error : new PeopleApiError({ status: 0, code: 'PEOPLE_DETAIL_NETWORK', message: 'Không thể kết nối để tải hồ sơ. Vui lòng thử lại.' }); }
async function load() {
  if (props.hostUnavailable) { setError(new PeopleApiError({ status: 503, code: 'HOST_ADAPTER_UNAVAILABLE', message: 'Native host chưa sẵn sàng. Ứng dụng không chuyển sang giao diện desktop thay thế.' })); return; }
  state.phase = 'loading'; state.error = null;
  try {
    const [payload, session] = await Promise.all([api.getDetail(props.personId), api.getCurrentUser()]);
    state.record = payload.record; state.detail = peopleDetailViewModel(payload); state.permissions = session?.permissions || null; state.mode = 'read'; state.phase = 'ready';
  } catch (error) { setError(error); }
}
async function saveEdit(payload) {
  state.saving = true; state.saveError = null;
  try { await api.update(props.personId, payload); await load(); }
  catch (error) { state.saveError = error instanceof PeopleApiError ? error.message : 'Không thể lưu hồ sơ. Vui lòng thử lại.'; }
  finally { state.saving = false; }
}
async function changeAttachment(operation) {
  state.attachmentWorking = true; state.attachmentError = null;
  try { await operation(); await load(); }
  catch (error) { state.attachmentError = error instanceof PeopleApiError ? error.message : 'Không thể cập nhật tệp đính kèm. Vui lòng thử lại.'; }
  finally { state.attachmentWorking = false; }
}
function uploadAttachments({ kind, visibility, files }) { return changeAttachment(() => api.upload(props.personId, files, { kind, visibility })); }
function setPrimaryAttachment(attachmentId) { return changeAttachment(() => api.setPrimary(props.personId, attachmentId)); }
function deleteAttachment(attachmentId) { return changeAttachment(() => api.deleteAttachment(attachmentId)); }
async function goBack() { if (isNative.value) { if (props.adapter) await props.adapter.goBack({ reason: 'people-detail' }); return; } emit('back'); }
function listenToHost() {
  if (!props.adapter || props.hostUnavailable) return;
  unsubscribers.push(props.adapter.subscribe(HostEvent.VIEWPORT, (payload) => { if (payload?.safeArea) safeArea.value = { ...safeArea.value, ...payload.safeArea }; }));
  unsubscribers.push(props.adapter.subscribe(HostEvent.LIFECYCLE, (payload) => { if (payload?.state === 'foreground' && state.mode === 'read') load(); }));
  unsubscribers.push(props.adapter.subscribe(HostEvent.DEEP_LINK, (payload) => { const match = /^\/?people\/(\d+)$/.exec(String(payload?.path || '').replace(/^#/, '')); if (match) emit('navigate', Number(match[1])); }));
}
watch(() => props.personId, load);
onMounted(() => { listenToHost(); load(); });
onBeforeUnmount(() => { while (unsubscribers.length) unsubscribers.pop()(); });
</script>

<template>
  <div v-if="state.phase === 'loading'" :class="isNative ? 'mds-mobile-app grid h-[100dvh] place-items-center bg-[var(--mds-bg)]' : 'grid min-h-[360px] place-items-center bg-[var(--mds-bg-page)]'" :style="isNative ? safeAreaStyle : undefined"><MSpinner :size="28" class="text-[var(--mds-brand-600)]" /></div>
  <section v-else-if="state.phase === 'error'" :class="isNative ? 'mds-mobile-app min-h-[100dvh] bg-[var(--mds-bg)]' : 'min-h-[360px] bg-[var(--mds-bg-page)]'" :style="isNative ? safeAreaStyle : undefined"><MMobileTopBar v-if="isNative" title="Hồ sơ nhân sự" @back="goBack" /><MEmptyState :title="state.error.status === 404 ? 'Không tìm thấy hồ sơ' : state.error.status === 403 ? 'Bạn không có quyền xem hồ sơ này' : 'Không thể mở hồ sơ'" :description="state.error.message" /></section>
  <PeopleEditFormMobile v-else-if="isNative && state.mode === 'edit'" :record="state.record" :saving="state.saving" :server-error="state.saveError" :safe-area-style="safeAreaStyle" @cancel="state.mode = 'read'" @save="saveEdit" />
  <PeopleDetailPageMobile v-else-if="isNative" :detail="state.detail" :can-edit="canEdit" :can-manage-id-docs="canManageIdDocs" :attachment-working="state.attachmentWorking" :attachment-error="state.attachmentError" :safe-area-style="safeAreaStyle" @back="goBack" @edit="state.mode = 'edit'" @upload="uploadAttachments" @set-primary="setPrimaryAttachment" @delete-attachment="deleteAttachment" />
  <PeopleEditFormDesktop v-else-if="state.mode === 'edit'" :record="state.record" :saving="state.saving" :server-error="state.saveError" @cancel="state.mode = 'read'" @save="saveEdit" />
  <PeopleDetailPage v-else :detail="state.detail" :can-edit="canEdit" :can-manage-id-docs="canManageIdDocs" :attachment-working="state.attachmentWorking" :attachment-error="state.attachmentError" @back="goBack" @edit="state.mode = 'edit'" @upload="uploadAttachments" @set-primary="setPrimaryAttachment" @delete-attachment="deleteAttachment" />
</template>
