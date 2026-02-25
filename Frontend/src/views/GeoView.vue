<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { useGeoStore } from '../stores/geo';
import GeoMap from '../components/geo/GeoMap.vue';
import UsersList from '../components/geo/UsersList.vue';
import DeviceManager from '../components/geo/DeviceManager.vue';

// Sidebar tab
const activeTab = ref<'users' | 'devices'>('users');

const geoStore = useGeoStore();

// Responsive
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024);
const isDesktop = computed(() => windowWidth.value > 768);
const onResize = () => { windowWidth.value = window.innerWidth; };

// Mobile panel
const showPanel = ref(false);
const togglePanel = () => { showPanel.value = !showPanel.value; };

// Stats
const stats = computed(() => ({
  usersOnline: geoStore.onlineUsers.length,
  devicesOnline: geoStore.onlineDevices.length,
}));

onMounted(async () => {
  window.addEventListener('resize', onResize);
  await geoStore.getUserLocation();

  if (import.meta.env.VITE_API_URL) {
    await geoStore.startDevicePolling();
  } else {
    geoStore.initializeMockUsers();
    geoStore.initializeMockDevices();
    setInterval(() => {
      geoStore.users.forEach((user) => {
        if (user.online && user.location) {
          user.location.latitude += (Math.random() - 0.5) * 0.001;
          user.location.longitude += (Math.random() - 0.5) * 0.001;
          user.timestamp = Date.now();
        }
      });
    }, 5000);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  geoStore.stopDevicePolling();
});
</script>

<template>
  <div class="geo-view">
    <!-- ═══ DESKTOP: sidebar a la izquierda + mapa a la derecha ═══ -->
    <aside v-if="isDesktop" class="desktop-sidebar">
      <div class="sidebar-tabs">
        <button class="tab-btn" :class="{ active: activeTab === 'users' }" @click="activeTab = 'users'">👥 Usuarios</button>
        <button class="tab-btn" :class="{ active: activeTab === 'devices' }" @click="activeTab = 'devices'">📡 Dispositivos</button>
      </div>
      <div class="sidebar-content">
        <UsersList v-if="activeTab === 'users'" />
        <DeviceManager v-else />
      </div>
    </aside>

    <!-- ═══ MAPA (siempre visible, llena el espacio restante) ═══ -->
    <div class="map-wrapper">
      <!-- Stats bar flotante (centrada sobre el mapa) -->
      <div class="stats-bar">
        <div class="stats-inner">
          <div class="stat-chip users">
            <span class="stat-icon">👥</span>
            <span class="stat-value">{{ stats.usersOnline }}</span>
            <span class="stat-label">online</span>
          </div>
          <div class="stat-chip devices">
            <span class="stat-icon">📡</span>
            <span class="stat-value">{{ stats.devicesOnline }}</span>
            <span class="stat-label">sensores</span>
          </div>
          <div class="stat-chip live">
            <span class="live-dot"></span>
            <span class="stat-label">EN VIVO</span>
          </div>
        </div>
      </div>

      <GeoMap />
    </div>

    <!-- ═══ MOBILE: bottom sheet + FAB ═══ -->
    <template v-if="!isDesktop">
      <!-- Backdrop -->
      <Transition name="fade">
        <div v-if="showPanel" class="backdrop" @click="showPanel = false"></div>
      </Transition>

      <!-- Bottom sheet -->
      <Transition name="sheet">
        <aside v-if="showPanel" class="mobile-sheet">
          <div class="sheet-handle" @click="showPanel = false">
            <div class="handle-bar"></div>
          </div>
          <div class="sidebar-tabs">
            <button class="tab-btn" :class="{ active: activeTab === 'users' }" @click="activeTab = 'users'">👥</button>
            <button class="tab-btn" :class="{ active: activeTab === 'devices' }" @click="activeTab = 'devices'">📡</button>
          </div>
          <UsersList v-if="activeTab === 'users'" @select-user="showPanel = false" />
          <DeviceManager v-else />
        </aside>
      </Transition>

      <!-- FAB -->
      <button v-if="!showPanel" class="fab" @click="togglePanel">
        <span class="fab-icon">👥</span>
        <span v-if="stats.usersOnline > 0" class="fab-badge">{{ stats.usersOnline }}</span>
      </button>
    </template>
  </div>
</template>

<style scoped>
.geo-view {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #0f172a;
}

/* ── Desktop sidebar (izquierda) ── */
.desktop-sidebar {
  width: 300px;
  height: 100%;
  flex-shrink: 0;
  background: rgba(15, 23, 42, 0.95);
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Tab bar */
.sidebar-tabs {
  display: flex;
  gap: 2px;
  padding: 8px 8px 0;
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  padding: 8px 0;
  border: none;
  border-radius: 8px 8px 0 0;
  background: rgba(255, 255, 255, 0.04);
  color: #64748b;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: rgba(59, 130, 246, 0.15);
  color: #93c5fd;
}

.tab-btn:hover:not(.active) {
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
}

.sidebar-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── Map wrapper (flex: 1) ── */
.map-wrapper {
  flex: 1;
  position: relative;
  min-width: 0;
  height: 100%;
}

/* ── Stats bar ── */
.stats-bar {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
}

.stats-inner {
  display: flex;
  gap: 6px;
  padding: 5px 10px;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 40px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.stat-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 0.72rem;
  color: #e2e8f0;
  white-space: nowrap;
}

.stat-chip.users { background: rgba(59, 130, 246, 0.12); }
.stat-chip.devices { background: rgba(34, 197, 94, 0.12); }
.stat-chip.live { background: rgba(239, 68, 68, 0.12); }

.stat-icon { font-size: 0.8rem; }
.stat-value { font-weight: 700; font-size: 0.8rem; color: #fff; }
.stat-label { font-weight: 500; color: #94a3b8; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.3px; }

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 6px rgba(239, 68, 68, 0.6);
  animation: livePulse 1.5s infinite;
}

@keyframes livePulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ── Mobile: bottom sheet ── */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0, 0, 0, 0.5);
}

.mobile-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60vh;
  z-index: 1200;
  background: rgba(15, 23, 42, 0.96);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sheet-handle {
  display: flex;
  justify-content: center;
  padding: 10px 0 4px;
  cursor: pointer;
  flex-shrink: 0;
}

.handle-bar {
  width: 36px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

/* ── FAB ── */
.fab {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  width: 54px;
  height: 54px;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
  cursor: pointer;
  box-shadow: 0 6px 24px rgba(59, 130, 246, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  animation: fabIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes fabIn {
  0% { transform: scale(0); }
  100% { transform: scale(1); }
}

.fab:hover { transform: scale(1.1); }
.fab:active { transform: scale(0.95); }
.fab-icon { font-size: 1.3rem; }

.fab-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 20px;
  height: 20px;
  padding: 0 4px;
  background: #ef4444;
  color: white;
  border-radius: 99px;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #0f172a;
}

/* ── Transitions ── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.sheet-enter-active { transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
.sheet-leave-active { transition: transform 0.25s ease; }
.sheet-enter-from, .sheet-leave-to { transform: translateY(100%); }

/* ── Mobile tweaks ── */
@media (max-width: 768px) {
  .stats-bar { top: 8px; }
  .stat-label { display: none; }
}

@media (max-width: 480px) {
  .stats-inner { gap: 3px; padding: 4px 6px; }
  .stat-chip { padding: 2px 6px; gap: 3px; }
  .fab { width: 48px; height: 48px; bottom: 16px; right: 16px; }
}
</style>
