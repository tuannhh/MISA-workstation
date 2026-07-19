<script setup>
import { nextTick, onMounted, ref } from 'vue';
import MIcon from './components/MIcon.vue';
import MHeaderIconAva from './components/MHeaderIconAva.vue';
import MHeaderIconChat from './components/MHeaderIconChat.vue';

const settingsOpen = ref(false);
const sideOpen = ref(false);
const sideCollapsed = ref(localStorage.getItem('mds-sidebar-expanded') === '0');
const theme = ref(localStorage.getItem('mds-theme') || 'blue');
const density = ref(localStorage.getItem('mds-density') || 'medium');
const headerMode = ref(localStorage.getItem('mds-header-mode') || 'brand');

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
  await nextTick();
  const legacy = document.createElement('script');
  legacy.src = '/app.js';
  legacy.defer = true;
  document.body.appendChild(legacy);
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

  <div id="app" class="hidden mds-app">
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
      <main class="main"><div class="content" id="view"></div></main>
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
