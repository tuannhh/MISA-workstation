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
import { createPeopleApi, PeopleApiError } from './domain/people-api.mjs';
import { peopleBookingsViewModel, peopleDetailViewModel } from './domain/people-detail.mjs';
import PeopleDetailPage from './desktop/PeopleDetailPage.vue';
import PeopleEditFormDesktop from './desktop/PeopleEditFormDesktop.vue';
import PeopleEditFormMobile from './mobile/PeopleEditFormMobile.vue';
import PeopleDetailPageMobile from './mobile/PeopleDetailPageMobile.vue';
import BookingCreateDesktop from './desktop/BookingCreateDesktop.vue';
import BookingCreateMobile from './mobile/BookingCreateMobile.vue';
import BookingEditDesktop from './desktop/BookingEditDesktop.vue';
import BookingEditMobile from './mobile/BookingEditMobile.vue';

const props = defineProps({ personId: { type: Number, required: true }, surface: { type: String, required: true }, adapter: { type: Object, default: null }, hostUnavailable: { type: Boolean, default: false } });
const emit = defineEmits(['back', 'navigate']);
const api = createPeopleApi();
const state = reactive({ phase: 'loading', detail: null, bookings: null, bookingError: null, bookingDeletingId: null, bookingDeleteError: null, record: null, currentUser: null, permissions: null, editingBooking: null, ownerReassign: null, ownerReassignBooking: null, ownerId: null, ownerReassignTarget: null, ownerReassignSaving: false, ownerReassignError: '', error: null, mode: 'read', saving: false, saveError: null, bookingSaving: false, bookingSaveError: null, deleting: false, deleteError: null, attachmentWorking: false, attachmentError: null });
const safeArea = ref(props.adapter?.getSafeArea?.() || {});
const unsubscribers = [];
const isNative = computed(() => props.surface === HostSurface.NATIVE);
const canEdit = computed(() => state.permissions?.modules?.partners?.includes('edit') === true);
const canManageIdDocs = computed(() => state.permissions?.canSeeSensitive === true);
const canDelete = computed(() => state.permissions?.modules?.partners?.includes('delete') === true && ['admin', 'super_admin'].includes(state.permissions?.role));
const canCreateBookings = computed(() => state.permissions?.modules?.partners?.includes('create') === true);
const canReassignBooking = computed(() => (booking) => Boolean(booking?.id) && state.permissions?.modules?.admin?.includes('edit') === true);
const safeAreaStyle = computed(() => Object.fromEntries(['top', 'right', 'bottom', 'left'].flatMap((side) => Number.isFinite(Number(safeArea.value?.[side])) ? [[`--mds-mobile-safe-${side}`, `${Number(safeArea.value[side])}px`]] : [])));

function setError(error) { state.phase = 'error'; state.error = error instanceof PeopleApiError ? error : new PeopleApiError({ status: 0, code: 'PEOPLE_DETAIL_NETWORK', message: 'Không thể kết nối để tải hồ sơ. Vui lòng thử lại.' }); }
async function load() {
  if (props.hostUnavailable) { setError(new PeopleApiError({ status: 503, code: 'HOST_ADAPTER_UNAVAILABLE', message: 'Native host chưa sẵn sàng. Ứng dụng không chuyển sang giao diện desktop thay thế.' })); return; }
  state.phase = 'loading'; state.error = null;
  try {
    const [payload, session] = await Promise.all([api.getDetail(props.personId), api.getCurrentUser()]);
    state.record = payload.record; state.detail = peopleDetailViewModel(payload); state.currentUser = session?.user || null; state.permissions = session?.permissions || null; state.editingBooking = null; state.mode = 'read'; state.bookings = null; state.bookingError = null; state.bookingDeleteError = null; state.phase = 'ready';
    try { state.bookings = peopleBookingsViewModel(await api.getBookings(props.personId)); } catch (error) { state.bookingError = error instanceof PeopleApiError ? error.message : 'Không thể tải booking.'; }
  } catch (error) { setError(error); }
}
async function saveEdit(payload) {
  state.saving = true; state.saveError = null;
  try { await api.update(props.personId, payload); await load(); }
  catch (error) { state.saveError = error instanceof PeopleApiError ? error.message : 'Không thể lưu hồ sơ. Vui lòng thử lại.'; }
  finally { state.saving = false; }
}
async function saveBooking(payload) { state.bookingSaving = true; state.bookingSaveError = null; try { await api.createBooking(payload); await load(); } catch (error) { state.bookingSaveError = error instanceof PeopleApiError ? error.message : 'Không thể tạo booking. Vui lòng thử lại.'; } finally { state.bookingSaving = false; } }
function canEditBooking(booking) { return state.permissions?.modules?.partners?.includes('edit') === true && (['admin', 'super_admin'].includes(state.currentUser?.role) || (state.currentUser?.role === 'executor' && Number(booking?.ownerId) === Number(state.currentUser?.id))); }
async function beginBookingOwnerReassign(booking) { if (!canReassignBooking.value(booking)) return; state.ownerReassignError = ''; state.ownerReassignTarget = null; state.ownerReassignBooking = { id: Number(booking.id), title: booking.title }; try { state.ownerReassign = ownerReassignViewModel({ record: { owner_id: booking.ownerId }, users: await api.getAdminUsers() }); state.ownerId = state.ownerReassign.ownerId; state.mode = 'booking-owner-reassign'; } catch (error) { state.ownerReassignError = error.message; state.mode = 'booking-owner-reassign'; } }
function requestBookingOwnerReassign() { try { const nextOwner = toOwnerReassignPayload(state.ownerId).owner_id; if (nextOwner === state.ownerReassign?.ownerId) throw new TypeError('Hãy chọn người phụ trách khác người hiện tại.'); state.ownerReassignTarget = state.ownerReassign?.owners.find((option) => option.value === nextOwner) || null; } catch (error) { state.ownerReassignError = error.message; } }
async function saveBookingOwnerReassign() { const target = state.ownerReassignTarget; const booking = state.ownerReassignBooking; if (!target || !booking?.id) return; state.ownerReassignSaving = true; state.ownerReassignError = ''; try { await api.reassignBookingOwner(booking.id, toOwnerReassignPayload(target.value).owner_id); state.ownerReassignTarget = null; await load(); } catch (error) { state.ownerReassignError = error.message; state.ownerReassignTarget = null; } finally { state.ownerReassignSaving = false; } }
function cancelBookingOwnerReassign() { state.ownerReassignTarget = null; state.ownerReassignError = ''; state.ownerReassignBooking = null; state.mode = 'read'; }
function beginBookingEdit(booking) { if (!canEditBooking(booking)) return; state.editingBooking = booking; state.bookingSaveError = null; state.mode = 'booking-edit'; }
async function saveBookingEdit(payload) { if (!state.editingBooking) return; state.bookingSaving = true; state.bookingSaveError = null; try { await api.updateBooking(state.editingBooking.id, payload); await load(); } catch (error) { state.bookingSaveError = error instanceof PeopleApiError ? error.message : 'Không thể cập nhật booking. Vui lòng thử lại.'; } finally { state.bookingSaving = false; } }
async function deleteBooking(bookingId) { state.bookingDeletingId = Number(bookingId); state.bookingDeleteError = null; try { await api.deleteBooking(bookingId); await load(); } catch (error) { state.bookingDeleteError = error instanceof PeopleApiError ? error.message : 'Không thể xóa booking. Vui lòng thử lại.'; } finally { state.bookingDeletingId = null; } }
async function changeAttachment(operation) {
  state.attachmentWorking = true; state.attachmentError = null;
  try { await operation(); await load(); }
  catch (error) { state.attachmentError = error instanceof PeopleApiError ? error.message : 'Không thể cập nhật tệp đính kèm. Vui lòng thử lại.'; }
  finally { state.attachmentWorking = false; }
}
function uploadAttachments({ kind, visibility, files }) { return changeAttachment(() => api.upload(props.personId, files, { kind, visibility })); }
function setPrimaryAttachment(attachmentId) { return changeAttachment(() => api.setPrimary(props.personId, attachmentId)); }
function deleteAttachment(attachmentId) { return changeAttachment(() => api.deleteAttachment(attachmentId)); }
async function deletePerson() {
  state.deleting = true; state.deleteError = null;
  try { await api.deletePerson(props.personId); await goBack(); }
  catch (error) { state.deleteError = error instanceof PeopleApiError ? error.message : 'Không thể xóa hồ sơ. Vui lòng thử lại.'; }
  finally { state.deleting = false; }
}
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
  <OwnerReassignMobile v-else-if="isNative && state.mode === 'booking-owner-reassign'" resource-label="Booking bài viết" :title="state.ownerReassignBooking?.title" :current-owner-label="state.ownerReassign?.currentOwnerLabel" :current-owner-id="state.ownerReassign?.ownerId" :owners="state.ownerReassign?.owners" :owner-id="state.ownerId" :saving="state.ownerReassignSaving" :error="state.ownerReassignError" :safe-area-style="safeAreaStyle" @back="cancelBookingOwnerReassign" @update:owner-id="state.ownerId=$event" @submit="requestBookingOwnerReassign" />
  <PeopleEditFormMobile v-else-if="isNative && state.mode === 'edit'" :record="state.record" :saving="state.saving" :server-error="state.saveError" :safe-area-style="safeAreaStyle" @cancel="state.mode = 'read'" @save="saveEdit" />
  <BookingCreateMobile v-else-if="isNative && state.mode === 'booking-create'" :person-id="props.personId" :person-name="state.detail.name" :saving="state.bookingSaving" :server-error="state.bookingSaveError" :safe-area-style="safeAreaStyle" @cancel="state.mode = 'read'" @save="saveBooking" />
  <BookingEditMobile v-else-if="isNative && state.mode === 'booking-edit'" :record="state.editingBooking" :saving="state.bookingSaving" :server-error="state.bookingSaveError" :safe-area-style="safeAreaStyle" @cancel="state.mode = 'read'" @save="saveBookingEdit" />
  <PeopleDetailPageMobile v-else-if="isNative" :detail="state.detail" :bookings="state.bookings?.rows || []" :booking-total="state.bookings?.totalAmount" :booking-error="state.bookingError" :booking-deleting-id="state.bookingDeletingId" :booking-delete-error="state.bookingDeleteError" :can-create-bookings="canCreateBookings" :can-edit-booking="canEditBooking" :can-reassign-booking="canReassignBooking" :can-edit="canEdit" :can-delete="canDelete" :delete-working="state.deleting" :delete-error="state.deleteError" :can-manage-id-docs="canManageIdDocs" :attachment-working="state.attachmentWorking" :attachment-error="state.attachmentError" :safe-area-style="safeAreaStyle" @back="goBack" @edit="state.mode = 'edit'" @create-booking="state.mode = 'booking-create'" @edit-booking="beginBookingEdit" @reassign-booking="beginBookingOwnerReassign" @delete-booking="deleteBooking" @delete-person="deletePerson" @upload="uploadAttachments" @set-primary="setPrimaryAttachment" @delete-attachment="deleteAttachment" />
  <OwnerReassignDesktop v-else-if="state.mode === 'booking-owner-reassign'" resource-label="Booking bài viết" :title="state.ownerReassignBooking?.title" :current-owner-label="state.ownerReassign?.currentOwnerLabel" :current-owner-id="state.ownerReassign?.ownerId" :owners="state.ownerReassign?.owners" :owner-id="state.ownerId" :saving="state.ownerReassignSaving" :error="state.ownerReassignError" @back="cancelBookingOwnerReassign" @update:owner-id="state.ownerId=$event" @submit="requestBookingOwnerReassign" />
  <PeopleEditFormDesktop v-else-if="state.mode === 'edit'" :record="state.record" :saving="state.saving" :server-error="state.saveError" @cancel="state.mode = 'read'" @save="saveEdit" />
  <BookingCreateDesktop v-else-if="state.mode === 'booking-create'" :person-id="props.personId" :person-name="state.detail.name" :saving="state.bookingSaving" :server-error="state.bookingSaveError" @cancel="state.mode = 'read'" @save="saveBooking" />
  <BookingEditDesktop v-else-if="state.mode === 'booking-edit'" :record="state.editingBooking" :saving="state.bookingSaving" :server-error="state.bookingSaveError" @cancel="state.mode = 'read'" @save="saveBookingEdit" />
  <PeopleDetailPage v-else :detail="state.detail" :bookings="state.bookings?.rows || []" :booking-total="state.bookings?.totalAmount" :booking-error="state.bookingError" :booking-deleting-id="state.bookingDeletingId" :booking-delete-error="state.bookingDeleteError" :can-create-bookings="canCreateBookings" :can-edit-booking="canEditBooking" :can-reassign-booking="canReassignBooking" :can-edit="canEdit" :can-delete="canDelete" :delete-working="state.deleting" :delete-error="state.deleteError" :can-manage-id-docs="canManageIdDocs" :attachment-working="state.attachmentWorking" :attachment-error="state.attachmentError" @back="goBack" @edit="state.mode = 'edit'" @create-booking="state.mode = 'booking-create'" @edit-booking="beginBookingEdit" @reassign-booking="beginBookingOwnerReassign" @delete-booking="deleteBooking" @delete-person="deletePerson" @upload="uploadAttachments" @set-primary="setPrimaryAttachment" @delete-attachment="deleteAttachment" />
  <MDialog :model-value="Boolean(state.ownerReassignTarget)" title="Xác nhận gán lại người phụ trách?" type="danger" confirm-text="Gán lại" @update:model-value="!$event&&(state.ownerReassignTarget=null)" @confirm="saveBookingOwnerReassign"><p>Booking bài viết sẽ được gán cho <strong>{{ state.ownerReassignTarget?.label }}</strong>. Máy chủ sẽ kiểm tra lại quyền Admin và trạng thái tài khoản trước khi lưu.</p></MDialog>
</template>
