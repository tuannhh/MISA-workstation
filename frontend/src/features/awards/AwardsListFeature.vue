<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import MEmptyState from '../../components/mds/MEmptyState.vue';
import MMobileTopBar from '../../components/mds/MMobileTopBar.vue';
import MSpinner from '../../components/mds/MSpinner.vue';
import { HostSurface } from '../../platform/host-adapter.mjs';
import { createAwardsApi } from './domain/awards-api.mjs';
import { awardDetailViewModel, awardsListViewModel } from './domain/award-view.mjs';
import AwardDetailDesktop from './desktop/AwardDetailDesktop.vue';
import AwardFormDesktop from './desktop/AwardFormDesktop.vue';
import AwardIntakeDesktop from './desktop/AwardIntakeDesktop.vue';
import AwardParticipationFormDesktop from './desktop/AwardParticipationFormDesktop.vue';
import AwardsListDesktop from './desktop/AwardsListDesktop.vue';
import AwardDetailMobile from './mobile/AwardDetailMobile.vue';
import AwardFormMobile from './mobile/AwardFormMobile.vue';
import AwardIntakeMobile from './mobile/AwardIntakeMobile.vue';
import AwardParticipationFormMobile from './mobile/AwardParticipationFormMobile.vue';
import AwardsListMobile from './mobile/AwardsListMobile.vue';

const props = defineProps({ awardId: { type: Number, default: null }, surface: String, adapter: Object, hostUnavailable: Boolean });
const emit = defineEmits(['back']); const api = createAwardsApi(); const isNative = computed(() => props.surface === HostSurface.NATIVE); const safeArea = ref(props.adapter?.getSafeArea?.() || {});
const state = reactive({ phase: 'loading', rows: [], total: 0, page: 1, pageSize: 20, search: '', detail: null, record: null, participationRecords: [], participationRecord: null, permissions: null, userId: null, mode: 'read', saving: false, uploading: false, extracting: false, saveError: '', participationError: '', fileError: '', intakeError: '', error: null });
const canCreate = computed(() => state.permissions?.modules?.awards?.includes('create') === true); const canEdit = computed(() => state.permissions?.modules?.awards?.includes('edit') === true); const canDeleteParticipation = computed(() => ['admin', 'super_admin'].includes(state.permissions?.role)); const canCreateParticipation = computed(() => canCreate.value);
const safeAreaStyle = computed(() => Object.fromEntries(['top', 'right', 'bottom', 'left'].flatMap((side) => Number.isFinite(Number(safeArea.value?.[side])) ? [[`--mds-mobile-safe-${side}`, `${Number(safeArea.value[side])}px`]] : [])));
const errorTitle = computed(() => state.error?.status === 404 ? 'Không tìm thấy giải thưởng' : state.error?.status === 403 ? 'Bạn không có quyền xem giải thưởng' : 'Không thể mở giải thưởng');
function participationById(id) { return state.participationRecords.find((item) => Number(item?.id) === Number(id)) || null; }
function canEditParticipation(id) { const item = participationById(id); return ['admin', 'super_admin'].includes(state.permissions?.role) || (state.permissions?.role === 'executor' && Number(item?.owner_id) === Number(state.userId)); }
async function load({ page = state.page, search = state.search } = {}) {
  if (props.hostUnavailable) { state.phase = 'error'; state.error = { status: 503, message: 'Native host chưa sẵn sàng. Ứng dụng không chuyển sang giao diện desktop thay thế.' }; return; }
  state.phase = 'loading'; state.error = null;
  try {
    const user = api.getCurrentUser();
    if (props.awardId) {
      const [payload, current] = await Promise.all([api.get(props.awardId), user]);
      Object.assign(state, { detail: awardDetailViewModel(payload), record: payload.record, participationRecords: Array.isArray(payload.participations) ? payload.participations : [], permissions: current.permissions || null, userId: Number(current.user?.id) || null, mode: 'detail', phase: 'ready' }); return;
    }
    const [payload, current] = await Promise.all([api.getList({ page, pageSize: state.pageSize, search }), user]);
    Object.assign(state, { ...awardsListViewModel(payload), permissions: current.permissions || null, userId: Number(current.user?.id) || null, mode: 'read', phase: 'ready' });
  } catch (error) { state.phase = 'error'; state.error = error; }
}
function open(id) { location.hash = `awards/${Number(id)}`; } function list() { location.hash = 'awards'; }
function create() { if (canCreate.value) { state.mode = 'create'; state.saveError = ''; } } function edit() { if (canEdit.value) { state.mode = 'edit'; state.saveError = ''; } }
function beginIntake() { if (canCreate.value) { state.intakeError = ''; state.mode = 'intake'; } }
async function extract(input) { state.extracting = true; state.intakeError = ''; try { const { extracted } = await api.extract(input); const draft = { ...extracted }; if (!state.permissions?.sensitiveGroups?.includes('org_fee')) delete draft.cost; state.record = draft; state.mode = 'create'; } catch (error) { state.intakeError = error.message; } finally { state.extracting = false; } }
function beginParticipation() { if (canCreateParticipation.value) { state.participationRecord = null; state.participationError = ''; state.mode = 'participation-create'; } }
function editParticipation(id) { if (canEditParticipation(id)) { state.participationRecord = participationById(id); state.participationError = ''; state.mode = 'participation-edit'; } }
function cancelParticipation() { state.participationRecord = null; state.participationError = ''; state.mode = 'detail'; }
async function save(input) { state.saving = true; try { const row = await api.save(input, props.awardId); if (props.awardId) await load(); else location.hash = `awards/${row.id}`; } catch (error) { state.saveError = error.message; } finally { state.saving = false; } }
async function saveParticipation(input) { state.saving = true; try { await api.saveParticipation(props.awardId, input, state.participationRecord?.id); await load(); } catch (error) { state.participationError = error.message; } finally { state.saving = false; } }
async function deleteParticipation(id) { try { await api.deleteParticipation(props.awardId, id); await load(); } catch (error) { state.participationError = error.message; } }
async function uploadFiles(files) { state.uploading = true; state.fileError = ''; try { await api.uploadFiles(props.awardId, files); await load(); } catch (error) { state.fileError = error.message; } finally { state.uploading = false; } }
function back() { if (isNative.value && props.adapter) return props.adapter.goBack({ reason: 'awards' }); emit('back'); }
watch(() => props.awardId, () => load()); onMounted(load);
</script>

<template><div v-if="state.phase === 'loading'" :class="isNative ? 'mds-mobile-app grid h-[100dvh] place-items-center bg-[var(--mds-bg)]' : 'grid min-h-[360px] place-items-center bg-[var(--mds-bg-page)]'"><MSpinner :size="28"/></div><section v-else-if="state.phase === 'error'" :class="isNative ? 'mds-mobile-app min-h-[100dvh] bg-[var(--mds-bg)]' : 'min-h-[360px] bg-[var(--mds-bg-page)]'"><MMobileTopBar v-if="isNative" title="Giải thưởng" @back="back"/><MEmptyState :title="errorTitle" :description="state.error.message"/></section><AwardIntakeMobile v-else-if="isNative && state.mode === 'intake'" :loading="state.extracting" :error="state.intakeError" :safe-area-style="safeAreaStyle" @cancel="state.mode = 'read'" @extract="extract"/><AwardParticipationFormMobile v-else-if="isNative && ['participation-create', 'participation-edit'].includes(state.mode)" :record="state.participationRecord" :editing="state.mode === 'participation-edit'" :saving="state.saving" :error="state.participationError" :safe-area-style="safeAreaStyle" @cancel="cancelParticipation" @save="saveParticipation"/><AwardFormMobile v-else-if="isNative && ['create', 'edit'].includes(state.mode)" :record="state.record" :editing="state.mode === 'edit'" :saving="state.saving" :error="state.saveError" :safe-area-style="safeAreaStyle" @cancel="state.mode = props.awardId ? 'detail' : 'read'" @save="save"/><AwardDetailMobile v-else-if="isNative && state.mode === 'detail'" :detail="state.detail" :can-edit="canEdit" :can-upload="canEdit" :uploading="state.uploading" :file-error="state.fileError" :can-create-participation="canCreateParticipation" :can-edit-participation="canEditParticipation" :can-delete-participation="canDeleteParticipation" :participation-error="state.participationError" :safe-area-style="safeAreaStyle" @back="list" @edit="edit" @upload="uploadFiles" @add-participation="beginParticipation" @edit-participation="editParticipation" @delete-participation="deleteParticipation"/><AwardsListMobile v-else-if="isNative" :rows="state.rows" :total="state.total" :page="state.page" :page-size="state.pageSize" :search="state.search" :can-create="canCreate" :can-intake="canCreate" :safe-area-style="safeAreaStyle" @back="back" @create="create" @intake="beginIntake" @open="open" @page="load({ page: $event })" @search="load({ page: 1, search: $event })"/><AwardIntakeDesktop v-else-if="state.mode === 'intake'" :loading="state.extracting" :error="state.intakeError" @cancel="state.mode = 'read'" @extract="extract"/><AwardParticipationFormDesktop v-else-if="['participation-create', 'participation-edit'].includes(state.mode)" :record="state.participationRecord" :editing="state.mode === 'participation-edit'" :saving="state.saving" :error="state.participationError" @cancel="cancelParticipation" @save="saveParticipation"/><AwardFormDesktop v-else-if="['create', 'edit'].includes(state.mode)" :record="state.record" :editing="state.mode === 'edit'" :saving="state.saving" :error="state.saveError" @cancel="state.mode = props.awardId ? 'detail' : 'read'" @save="save"/><AwardDetailDesktop v-else-if="state.mode === 'detail'" :detail="state.detail" :can-edit="canEdit" :can-upload="canEdit" :uploading="state.uploading" :file-error="state.fileError" :can-create-participation="canCreateParticipation" :can-edit-participation="canEditParticipation" :can-delete-participation="canDeleteParticipation" :participation-error="state.participationError" @back="list" @edit="edit" @upload="uploadFiles" @add-participation="beginParticipation" @edit-participation="editParticipation" @delete-participation="deleteParticipation"/><AwardsListDesktop v-else :rows="state.rows" :total="state.total" :page="state.page" :page-size="state.pageSize" :search="state.search" :loading="state.phase === 'loading'" :can-create="canCreate" :can-intake="canCreate" @create="create" @intake="beginIntake" @open="open" @page="load({ page: $event })" @search="load({ page: 1, search: $event })"/></template>
