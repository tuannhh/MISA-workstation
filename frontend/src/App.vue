<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import MIcon from './components/MIcon.vue';
import MHeaderIconAva from './components/MHeaderIconAva.vue';
import MHeaderIconChat from './components/MHeaderIconChat.vue';
import PeopleDetailFeature from './features/people/PeopleDetailFeature.vue';
import PeopleListFeature from './features/people/PeopleListFeature.vue';
import PartnerDetailFeature from './features/partners/PartnerDetailFeature.vue';
import SupplierDetailFeature from './features/suppliers/SupplierDetailFeature.vue';
import InteractionsListFeature from './features/interactions/InteractionsListFeature.vue';
import {
  HostSurface,
  assertHostAdapter,
  createFakeBrowserHostAdapter,
  createFakeNativeHostAdapter,
  createHostAdapterRegistry,
} from './platform/host-adapter.mjs';

const settingsOpen = ref(false);
const sideOpen = ref(false);
const sideCollapsed = ref(localStorage.getItem('mds-sidebar-expanded') === '0');
const theme = ref(localStorage.getItem('mds-theme') || 'blue');
const density = ref(localStorage.getItem('mds-density') || 'medium');
const headerMode = ref(localStorage.getItem('mds-header-mode') || 'brand');
const peopleFeatureRoute = ref(null);
const peopleListFeatureRoute = ref(null);
const partnerFeatureRoute = ref(null);
const supplierFeatureRoute = ref(null);
const interactionsFeatureRoute = ref(null);
const desktopAdapter = createFakeBrowserHostAdapter();
const isLocalUiHarness = ['localhost', '127.0.0.1'].includes(location.hostname);
const localUiParams = isLocalUiHarness ? new URLSearchParams(location.search) : null;

// W3.PEOPLE.READ chỉ là strangler pilot. Host/staging bật cờ này sau khi
// kiểm chứng; mặc định false để không làm mất các thao tác write/file legacy.
function isPeoplePilotEnabled() {
  return window.__MISA_UI_FEATURE_FLAGS__?.peopleDetailRead === true || window.__MISA_UI_FEATURE_FLAGS__?.peopleListRead === true || localUiParams?.get('uiPeoplePilot') === '1';
}
function isPeopleListPilotEnabled() {
  return window.__MISA_UI_FEATURE_FLAGS__?.peopleListRead === true || localUiParams?.get('uiPeoplePilot') === '1';
}
function isPartnerPilotEnabled() {
  return window.__MISA_UI_FEATURE_FLAGS__?.partnerDetailRead === true || localUiParams?.get('uiPartnerPilot') === '1';
}
function isSupplierPilotEnabled() {
  return window.__MISA_UI_FEATURE_FLAGS__?.supplierDetailRead === true || localUiParams?.get('uiSupplierPilot') === '1';
}
function isInteractionsPilotEnabled() { return window.__MISA_UI_FEATURE_FLAGS__?.interactionsListRead === true || localUiParams?.get('uiInteractionsPilot') === '1'; }

function requestedSurface(queryParam = 'uiPeopleSurface') {
  if (localUiParams?.get(queryParam) === HostSurface.NATIVE) return HostSurface.NATIVE;
  return window.__MISA_UI_HOST_BOOTSTRAP__?.surface === HostSurface.NATIVE
    ? HostSurface.NATIVE
    : HostSurface.DESKTOP;
}

function selectHostAdapter(surface, nativeQueryParam = 'uiPeopleSurface') {
  const nativeCandidate = window.__MISA_UI_HOST_ADAPTER__;
  // Chỉ harness localhost mới có fake native. Deploy luôn đòi adapter host thật
  // và vẫn fail-closed nếu O3 chưa cấp bridge contract.
  const native = nativeCandidate ? assertHostAdapter(nativeCandidate)
    : (isLocalUiHarness && localUiParams?.get(nativeQueryParam) === HostSurface.NATIVE
      ? createFakeNativeHostAdapter({ safeArea: { top: 24, bottom: 20 } }) : null);
  return createHostAdapterRegistry({ browser: desktopAdapter, native }).select(surface);
}

function resolvePeopleDetailRoute(key) {
  const match = /^person\/(\d+)$/.exec(key);
  if (!isPeoplePilotEnabled() || !match) {
    peopleFeatureRoute.value = null;
    return false;
  }
  const surface = requestedSurface();
  try {
    peopleFeatureRoute.value = { personId: Number(match[1]), surface, adapter: selectHostAdapter(surface), hostUnavailable: false };
  } catch (error) {
    if (surface !== HostSurface.NATIVE) throw error;
    // Native never falls back to the desktop composition when its provider is
    // missing or invalid.  The native page shows an explicit recovery state instead.
    peopleFeatureRoute.value = { personId: Number(match[1]), surface, adapter: null, hostUnavailable: true };
  }
  return true;
}

function resolvePeopleListRoute(key) {
  if (!isPeopleListPilotEnabled() || key !== 'people') { peopleListFeatureRoute.value = null; return false; }
  peopleFeatureRoute.value = null;
  const surface = requestedSurface();
  try { peopleListFeatureRoute.value = { surface, adapter: selectHostAdapter(surface), hostUnavailable: false }; }
  catch (error) {
    if (surface !== HostSurface.NATIVE) throw error;
    peopleListFeatureRoute.value = { surface, adapter: null, hostUnavailable: true };
  }
  return true;
}

function resolvePartnerDetailRoute(key) {
  const match = /^partner\/(\d+)$/.exec(key);
  if (!isPartnerPilotEnabled() || !match) {
    partnerFeatureRoute.value = null;
    return false;
  }
  const surface = requestedSurface();
  try {
    partnerFeatureRoute.value = { partnerId: Number(match[1]), surface, adapter: selectHostAdapter(surface), hostUnavailable: false };
  } catch (error) {
    if (surface !== HostSurface.NATIVE) throw error;
    partnerFeatureRoute.value = { partnerId: Number(match[1]), surface, adapter: null, hostUnavailable: true };
  }
  return true;
}

function resolveSupplierDetailRoute(key) {
  const match = /^suppliers\/(\d+)$/.exec(key);
  if (!isSupplierPilotEnabled() || !match) {
    supplierFeatureRoute.value = null;
    return false;
  }
  const surface = requestedSurface('uiSupplierSurface');
  try {
    supplierFeatureRoute.value = { supplierId: Number(match[1]), surface, adapter: selectHostAdapter(surface, 'uiSupplierSurface'), hostUnavailable: false };
  } catch (error) {
    if (surface !== HostSurface.NATIVE) throw error;
    supplierFeatureRoute.value = { supplierId: Number(match[1]), surface, adapter: null, hostUnavailable: true };
  }
  return true;
}

function resolveInteractionsRoute(key) {
  if (!isInteractionsPilotEnabled() || key !== 'interactions') { interactionsFeatureRoute.value = null; return false; }
  const surface = requestedSurface('uiInteractionsSurface');
  try { interactionsFeatureRoute.value = { surface, adapter: selectHostAdapter(surface, 'uiInteractionsSurface'), hostUnavailable: false }; }
  catch (error) { if (surface !== HostSurface.NATIVE) throw error; interactionsFeatureRoute.value = { surface, adapter: null, hostUnavailable: true }; }
  return true;
}

function leavePeopleDetail() {
  peopleFeatureRoute.value = null;
  location.hash = 'people';
}
function leavePeopleList() { peopleListFeatureRoute.value = null; location.hash = 'dashboard'; }
function leavePartnerDetail(listingHash = 'press') {
  partnerFeatureRoute.value = null;
  location.hash = ['press', 'association', 'gov', 'other'].includes(listingHash) ? listingHash : 'press';
}
function leaveSupplierDetail() {
  supplierFeatureRoute.value = null;
  location.hash = 'suppliers';
}
function leaveInteractions() { interactionsFeatureRoute.value = null; location.hash = 'dashboard'; }

function navigatePeopleDetail(personId) {
  location.hash = `person/${personId}`;
}
const desktopPeopleFeature = computed(() => peopleFeatureRoute.value?.surface === HostSurface.DESKTOP ? peopleFeatureRoute.value : null);
const nativePeopleFeature = computed(() => peopleFeatureRoute.value?.surface === HostSurface.NATIVE ? peopleFeatureRoute.value : null);
const desktopPeopleListFeature = computed(() => peopleListFeatureRoute.value?.surface === HostSurface.DESKTOP ? peopleListFeatureRoute.value : null);
const nativePeopleListFeature = computed(() => peopleListFeatureRoute.value?.surface === HostSurface.NATIVE ? peopleListFeatureRoute.value : null);
const desktopPartnerFeature = computed(() => partnerFeatureRoute.value?.surface === HostSurface.DESKTOP ? partnerFeatureRoute.value : null);
const nativePartnerFeature = computed(() => partnerFeatureRoute.value?.surface === HostSurface.NATIVE ? partnerFeatureRoute.value : null);
const desktopSupplierFeature = computed(() => supplierFeatureRoute.value?.surface === HostSurface.DESKTOP ? supplierFeatureRoute.value : null);
const nativeSupplierFeature = computed(() => supplierFeatureRoute.value?.surface === HostSurface.NATIVE ? supplierFeatureRoute.value : null);
const desktopInteractionsFeature = computed(() => interactionsFeatureRoute.value?.surface === HostSurface.DESKTOP ? interactionsFeatureRoute.value : null);
const nativeInteractionsFeature = computed(() => interactionsFeatureRoute.value?.surface === HostSurface.NATIVE ? interactionsFeatureRoute.value : null);
const resolveUiFeatureRoute = (key) => resolvePeopleListRoute(key) || resolvePeopleDetailRoute(key) || resolvePartnerDetailRoute(key) || resolveSupplierDetailRoute(key) || resolveInteractionsRoute(key);

// 10 theme chính thức của MDS (khớp file token trong assets/tokens/themes)
const THEMES = [
  { key: 'blue', label: 'Xanh MISA', color: '#245FDF' },
  { key: 'indigo', label: 'Chàm', color: '#4155F5' },
  { key: 'cyan', label: 'Xanh ngọc', color: '#00A2CF' },
  { key: 'teal', label: 'Xanh mòng két', color: '#0E9384' },
  { key: 'green', label: 'Xanh lá', color: '#0E9A62' },
  { key: 'orange', label: 'Cam', color: '#EA580C' },
  { key: 'red', label: 'Đỏ', color: '#C34266' },
  { key: 'pink', label: 'Hồng', color: '#C64691' },
  { key: 'purple', label: 'Tím', color: '#744EC7' },
  { key: 'blue-gray', label: 'Xanh xám', color: '#4E5BA6' },
];

function toggleSide() {
  sideCollapsed.value = !sideCollapsed.value;
  localStorage.setItem('mds-sidebar-expanded', sideCollapsed.value ? '0' : '1');
}

function applyPreferences() {
  document.documentElement.dataset.mdsTheme = theme.value;
  document.documentElement.dataset.density = density.value;
  document.documentElement.dataset.headerMode = headerMode.value;
}

function savePreferences() {
  localStorage.setItem('mds-theme', theme.value);
  localStorage.setItem('mds-density', density.value);
  localStorage.setItem('mds-header-mode', headerMode.value);
  applyPreferences();
  settingsOpen.value = false;
}

onMounted(async () => {
  applyPreferences();
  window.__misaUiFeatureRouter = { resolve: resolveUiFeatureRoute };
  await nextTick();
  const legacy = document.createElement('script');
  legacy.src = '/app.js';
  legacy.defer = true;
  document.body.appendChild(legacy);
});

onBeforeUnmount(() => {
  if (window.__misaUiFeatureRouter?.resolve === resolveUiFeatureRoute) delete window.__misaUiFeatureRouter;
});
</script>

<template>
  <div id="login" class="antialiased">
    <div class="login-card mds-card">
      <img class="login-logo" :src="'/assets/misa-logo.png'" alt="MISA" />
      <h1>MISA PR Workstation</h1>
      <p class="sub">Hệ thống quản trị và giám sát truyền thông</p>
      <form id="loginForm">
        <label for="username">Tài khoản</label>
        <input id="username" autocomplete="username" required autofocus />
        <label for="password">Mật khẩu</label>
        <input id="password" type="password" autocomplete="current-password" required />
        <button class="btn primary login-submit" type="submit">Đăng nhập</button>
        <div class="login-err" id="loginErr" role="alert"></div>
      </form>
      <div class="quick">
        <div class="qt">Đăng nhập nhanh</div>
        <button data-u="admin" data-p="admin123"><b>Quản lý phòng</b><span>Toàn quyền</span></button>
        <button data-u="chuyenvien" data-p="123456"><b>Chuyên viên PR</b><span>Nhập liệu theo phân quyền</span></button>
      </div>
      <div class="copyright">Copyright © 1994 - {{ new Date().getFullYear() }} MISA JSC</div>
    </div>
  </div>

  <!-- Native composition is a sibling of the desktop legacy shell. The shell
       remains mounted only for its legacy router contract, never as mobile UI. -->
  <PeopleDetailFeature
    v-if="nativePeopleFeature"
    :person-id="nativePeopleFeature.personId"
    :surface="nativePeopleFeature.surface"
    :adapter="nativePeopleFeature.adapter"
    :host-unavailable="nativePeopleFeature.hostUnavailable"
    @back="leavePeopleDetail"
    @navigate="navigatePeopleDetail"
  />
  <PeopleListFeature
    v-if="nativePeopleListFeature"
    :surface="nativePeopleListFeature.surface"
    :adapter="nativePeopleListFeature.adapter"
    :host-unavailable="nativePeopleListFeature.hostUnavailable"
    @back="leavePeopleList"
    @open="navigatePeopleDetail"
  />
  <PartnerDetailFeature
    v-if="nativePartnerFeature"
    :partner-id="nativePartnerFeature.partnerId"
    :surface="nativePartnerFeature.surface"
    :adapter="nativePartnerFeature.adapter"
    :host-unavailable="nativePartnerFeature.hostUnavailable"
    @back="leavePartnerDetail"
    @navigate="navigatePeopleDetail"
  />
  <SupplierDetailFeature
    v-if="nativeSupplierFeature"
    :supplier-id="nativeSupplierFeature.supplierId"
    :surface="nativeSupplierFeature.surface"
    :adapter="nativeSupplierFeature.adapter"
    :host-unavailable="nativeSupplierFeature.hostUnavailable"
    @back="leaveSupplierDetail"
  />
  <InteractionsListFeature v-if="nativeInteractionsFeature" :surface="nativeInteractionsFeature.surface" :adapter="nativeInteractionsFeature.adapter" :host-unavailable="nativeInteractionsFeature.hostUnavailable" @back="leaveInteractions" />

  <div id="app" class="hidden mds-app" :class="{ hidden: nativePeopleFeature || nativePeopleListFeature || nativePartnerFeature || nativeSupplierFeature || nativeInteractionsFeature }">
    <header class="platform-header">
      <button class="header-action" type="button" title="Mở điều hướng" aria-label="Mở điều hướng" @click="sideOpen = !sideOpen"><MIcon name="grid-dots" :size="20" /></button>
      <img class="app-logo-img" :src="headerMode === 'light' ? '/assets/misa-logo.png' : '/assets/misa-logo-white.png'" alt="MISA" />
      <div class="app-title">PR Workstation</div>
      <div class="header-divider"></div>
      <div id="crumb" class="header-crumb"></div>
      <div class="header-spacer"></div>
      <button class="header-action" type="button" title="Thiết lập màu sắc và hiển thị" aria-label="Thiết lập" @click="settingsOpen = true"><MIcon name="settings" :size="20" /></button>
      <button class="header-action" type="button" title="Trợ lý số MISA AVA" aria-label="MISA AVA"><MHeaderIconAva :size="24" /></button>
      <button class="header-action chat-icon" type="button" title="AMIS Chat" aria-label="AMIS Chat"><MHeaderIconChat :size="20" /></button>
      <div class="bell header-action" id="bell" title="Thông báo nhắc"><MIcon name="bell" :size="20" /><span class="bell-badge hidden" id="bellBadge">0</span><div class="bell-panel hidden" id="bellPanel"></div></div>
      <button class="header-action" type="button" title="Trợ giúp" aria-label="Trợ giúp"><MIcon name="help-circle" :size="20" /></button>
      <button class="header-action" type="button" title="Tiện ích khác" aria-label="Tiện ích khác"><MIcon name="dots-circle-horizontal" :size="20" /></button>
      <div class="identity"><div><div class="nm" id="userName"></div><div class="rl" id="userRole"></div></div><div class="avatar" id="avatar"></div></div>
      <button class="header-action" type="button" id="logoutBtn" title="Đăng xuất" aria-label="Đăng xuất"><MIcon name="logout" :size="20" /></button>
    </header>
    <button v-if="sideOpen" class="mobile-nav-overlay" type="button" aria-label="Đóng điều hướng" @click="sideOpen = false"></button>
    <div class="app-body" :class="{ 'side-collapsed': sideCollapsed }">
      <aside class="sidebar" :class="{ 'mobile-open': sideOpen }">
        <nav class="nav" id="nav" @click="sideOpen = false"></nav>
        <button class="side-toggle" type="button" :title="sideCollapsed ? 'Ghim mở rộng' : 'Thu gọn'" :aria-label="sideCollapsed ? 'Mở rộng' : 'Thu gọn'" @click="toggleSide">
          <MIcon :name="sideCollapsed ? 'chevron-right' : 'chevron-left'" :size="20" />
        </button>
      </aside>
      <main class="main">
        <div v-show="!desktopPeopleFeature && !desktopPeopleListFeature && !desktopPartnerFeature && !desktopSupplierFeature && !desktopInteractionsFeature" class="content" id="view"></div>
        <PeopleListFeature
          v-if="desktopPeopleListFeature"
          :surface="desktopPeopleListFeature.surface"
          :adapter="desktopPeopleListFeature.adapter"
          @back="leavePeopleList"
          @open="navigatePeopleDetail"
        />
        <PeopleDetailFeature
          v-if="desktopPeopleFeature"
          :person-id="desktopPeopleFeature.personId"
          :surface="desktopPeopleFeature.surface"
          :adapter="desktopPeopleFeature.adapter"
          @back="leavePeopleDetail"
          @navigate="navigatePeopleDetail"
        />
        <PartnerDetailFeature
          v-if="desktopPartnerFeature"
          :partner-id="desktopPartnerFeature.partnerId"
          :surface="desktopPartnerFeature.surface"
          :adapter="desktopPartnerFeature.adapter"
          @back="leavePartnerDetail"
          @navigate="navigatePeopleDetail"
        />
        <SupplierDetailFeature
          v-if="desktopSupplierFeature"
          :supplier-id="desktopSupplierFeature.supplierId"
          :surface="desktopSupplierFeature.surface"
          :adapter="desktopSupplierFeature.adapter"
          @back="leaveSupplierDetail"
        />
        <InteractionsListFeature v-if="desktopInteractionsFeature" :surface="desktopInteractionsFeature.surface" :adapter="desktopInteractionsFeature.adapter" @back="leaveInteractions" />
      </main>
    </div>
  </div>

  <div id="modalRoot"></div>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>

  <div v-if="settingsOpen" class="modal-bg settings-layer" @click.self="settingsOpen = false">
    <section class="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div class="mhead"><h3 id="settings-title">Thiết lập màu sắc và hiển thị</h3><button class="x" type="button" aria-label="Đóng" @click="settingsOpen = false"><MIcon name="x" :size="20" /></button></div>
      <div class="mbody settings-body">
        <section class="set-block">
          <div class="set-title">Giao diện</div>
          <div class="mode-row">
            <button type="button" class="mode-card" :class="{ sel: headerMode === 'brand' }" @click="headerMode = 'brand'">
              <span class="mode-swatch" :style="{ background: (THEMES.find(t => t.key === theme) || {}).color }"></span>
              <span>Màu sắc</span>
            </button>
            <button type="button" class="mode-card" :class="{ sel: headerMode === 'light' }" @click="headerMode = 'light'">
              <span class="mode-swatch light"></span>
              <span>Sáng</span>
            </button>
          </div>
        </section>
        <section class="set-block">
          <div class="set-title">Màu chủ đạo</div>
          <div class="swatch-row">
            <button v-for="t in THEMES" :key="t.key" type="button" class="swatch" :class="{ sel: theme === t.key }" :title="t.label" :aria-label="t.label" @click="theme = t.key">
              <span class="swatch-dot" :style="{ background: t.color }"></span>
              <span class="swatch-lb">{{ t.label }}</span>
            </button>
          </div>
        </section>
        <section class="set-block">
          <div class="set-title">Mật độ hiển thị</div>
          <div class="mode-row">
            <button type="button" class="density-card" :class="{ sel: density === 'compact' }" @click="density = 'compact'">Compact</button>
            <button type="button" class="density-card" :class="{ sel: density === 'medium' }" @click="density = 'medium'">Trung bình</button>
            <button type="button" class="density-card" :class="{ sel: density === 'comfortable' }" @click="density = 'comfortable'">Rộng</button>
          </div>
        </section>
      </div>
      <div class="mfoot"><button class="btn" type="button" @click="settingsOpen = false">Hủy</button><button class="btn primary" type="button" @click="savePreferences">Lưu</button></div>
    </section>
  </div>
</template>
