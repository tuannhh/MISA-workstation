<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import MEmptyState from '../../components/mds/MEmptyState.vue';
import MMobileTopBar from '../../components/mds/MMobileTopBar.vue';
import MSpinner from '../../components/mds/MSpinner.vue';
import { HostEvent, HostSurface } from '../../platform/host-adapter.mjs';
import { createPeopleApi, PeopleApiError } from './domain/people-api.mjs';
import { peopleListViewModel } from './domain/people-detail.mjs';
import PeopleListDesktop from './desktop/PeopleListDesktop.vue';
import PeopleListMobile from './mobile/PeopleListMobile.vue';
import PeopleCreateDesktop from './desktop/PeopleCreateDesktop.vue';
import PeopleCreateMobile from './mobile/PeopleCreateMobile.vue';

const props = defineProps({ surface: { type: String, required: true }, adapter: { type: Object, default: null }, hostUnavailable: { type: Boolean, default: false } });
const emit = defineEmits(['back', 'open']); const api = createPeopleApi();
const state = reactive({ phase: 'loading', rows: [], total: 0, page: 1, pageSize: 20, search: '', organizations: [], permissions: null, mode: 'read', creating: false, createError: '', error: null }); const safeArea = ref(props.adapter?.getSafeArea?.() || {}); const unsubscribers = [];
const isNative = computed(() => props.surface === HostSurface.NATIVE); const safeAreaStyle = computed(() => Object.fromEntries(['top', 'right', 'bottom', 'left'].flatMap((side) => Number.isFinite(Number(safeArea.value?.[side])) ? [[`--mds-mobile-safe-${side}`, `${Number(safeArea.value[side])}px`]] : [])));
const canCreate = computed(() => state.permissions?.modules?.partners?.includes('create') === true);
const organizationOptions = computed(() => state.organizations.map((org) => ({ value: Number(org.id), label: `${org.name}${org.org_type ? ` · ${({ press: 'Báo chí', association: 'Hiệp hội', gov: 'Bộ ngành', other: 'Khác' })[org.org_type] || org.org_type}` : ''}` })).filter((org) => Number.isInteger(org.value) && org.value > 0));
function setError(error) { state.error = error instanceof PeopleApiError ? error : new PeopleApiError({ status: 0, code: 'PEOPLE_LIST_NETWORK', message: 'Không thể tải danh bạ. Vui lòng thử lại.' }); state.phase = 'error'; }
async function load({ page = state.page, search = state.search } = {}) { if (props.hostUnavailable) { setError(new PeopleApiError({ status: 503, code: 'HOST_ADAPTER_UNAVAILABLE', message: 'Native host chưa sẵn sàng. Ứng dụng không chuyển sang giao diện desktop thay thế.' })); return; } state.phase = 'loading'; state.error = null; try { const [payload, session, organizations] = await Promise.all([api.getList({ page, pageSize: state.pageSize, search }), api.getCurrentUser(), api.getOrganizations()]); const model = peopleListViewModel(payload); state.rows = model.rows; state.total = model.total; state.page = model.page; state.pageSize = model.pageSize; state.search = search; state.permissions = session?.permissions || null; state.organizations = organizations; state.mode = 'read'; state.phase = 'ready'; } catch (error) { setError(error); } }
function search(value) { load({ page: 1, search: value }); }
function changePage(page) { load({ page, search: state.search }); }
function beginCreate() { if (!canCreate.value) return; state.createError = ''; state.mode = 'create'; }
async function createPerson(payload) { state.creating = true; state.createError = ''; try { const result = await api.createPerson(payload); emit('open', result.id); } catch (error) { state.createError = error instanceof PeopleApiError ? error.message : 'Không thể tạo nhân sự. Vui lòng thử lại.'; } finally { state.creating = false; } }
async function goBack() { if (isNative.value && props.adapter) { await props.adapter.goBack({ reason: 'people-list' }); return; } emit('back'); }
function listenToHost() { if (!props.adapter || props.hostUnavailable) return; unsubscribers.push(props.adapter.subscribe(HostEvent.VIEWPORT, (payload) => { if (payload?.safeArea) safeArea.value = { ...safeArea.value, ...payload.safeArea }; })); unsubscribers.push(props.adapter.subscribe(HostEvent.LIFECYCLE, (payload) => { if (payload?.state === 'foreground') load(); })); }
onMounted(() => { listenToHost(); load(); }); onBeforeUnmount(() => { while (unsubscribers.length) unsubscribers.pop()(); });
</script>

<template><div v-if="state.phase === 'loading'" :class="isNative ? 'mds-mobile-app grid h-[100dvh] place-items-center bg-[var(--mds-bg)]' : 'grid min-h-[360px] place-items-center bg-[var(--mds-bg-page)]'" :style="isNative ? safeAreaStyle : undefined"><MSpinner :size="28" class="text-[var(--mds-brand-600)]" /></div><section v-else-if="state.phase === 'error'" :class="isNative ? 'mds-mobile-app min-h-[100dvh] bg-[var(--mds-bg)]' : 'min-h-[360px] bg-[var(--mds-bg-page)]'" :style="isNative ? safeAreaStyle : undefined"><MMobileTopBar v-if="isNative" title="Danh bạ nhân sự" @back="goBack" /><MEmptyState :title="state.error.status === 403 ? 'Bạn không có quyền xem danh bạ' : 'Không thể mở danh bạ'" :description="state.error.message" /></section><PeopleCreateMobile v-else-if="isNative && state.mode === 'create'" :organizations="organizationOptions" :saving="state.creating" :server-error="state.createError" :safe-area-style="safeAreaStyle" @cancel="state.mode = 'read'" @save="createPerson" /><PeopleListMobile v-else-if="isNative" :rows="state.rows" :total="state.total" :page="state.page" :page-size="state.pageSize" :search="state.search" :loading="false" :can-create="canCreate" :safe-area-style="safeAreaStyle" @back="goBack" @search="search" @page="changePage" @create="beginCreate" @open="emit('open', $event)" /><PeopleCreateDesktop v-else-if="state.mode === 'create'" :organizations="organizationOptions" :saving="state.creating" :server-error="state.createError" @cancel="state.mode = 'read'" @save="createPerson" /><PeopleListDesktop v-else :rows="state.rows" :total="state.total" :page="state.page" :page-size="state.pageSize" :search="state.search" :loading="false" :can-create="canCreate" @search="search" @page="changePage" @create="beginCreate" @open="emit('open', $event)" /></template>
