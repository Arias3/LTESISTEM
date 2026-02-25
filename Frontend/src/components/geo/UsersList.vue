<script setup lang="ts">
import { useGeoStore } from '../../stores/geo';
import { computed } from 'vue';
import type { User } from '../../stores/geo';

const geoStore = useGeoStore();
const emit = defineEmits(['select-user']);

const sortedUsers = computed(() => {
  return [...geoStore.users].sort((a, b) => {
    if (a.online && !b.online) return -1;
    if (!a.online && b.online) return 1;
    return b.timestamp - a.timestamp;
  });
});

const getRoleColor = (role: string): string => {
  const colors: Record<string, string> = {
    ADMIN: '#8b5cf6',
    Administrador: '#8b5cf6',
    OPERATOR: '#3b82f6',
    Técnico: '#06b6d4',
    Monitor: '#10b981',
    MOBILE: '#f59e0b',
    Usuario: '#3b82f6',
  };
  return colors[role] || '#3b82f6';
};

const getInitials = (name: string): string => {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
};

const timeAgo = (timestamp: number): string => {
  if (!timestamp || timestamp <= 0) return 'sin datos';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'ahora';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
};

const handleSelect = (user: User) => {
  if (!user.location) return;
  geoStore.selectMarker(user);
  emit('select-user');
};

const formatLocation = (user: User): string => {
  if (!user.location) return 'Sin ubicación registrada';
  return `${user.location.latitude.toFixed(5)}, ${user.location.longitude.toFixed(5)}`;
};
</script>

<template>
  <div class="users-panel">

    <!-- Search / filter -->
    <div class="panel-search">
      <span class="search-icon">🔍</span>
      <span class="search-placeholder">Buscar usuario...</span>
    </div>

    <div class="users-scroll">
      <TransitionGroup name="user-list" tag="div" class="users-grid">
        <div
          v-for="user in sortedUsers"
          :key="user.id"
          class="user-card"
          :class="{
            active: geoStore.selectedMarker?.id === user.id,
            offline: !user.online
          }"
          @click="handleSelect(user)"
        >
          <div class="user-avatar" :style="{ background: `linear-gradient(135deg, ${getRoleColor(user.role)}, ${getRoleColor(user.role)}cc)` }">
            {{ getInitials(user.name) }}
            <span class="avatar-status" :class="{ online: user.online }"></span>
          </div>

          <div class="user-details">
            <span class="user-name">{{ user.name }}</span>
            <span class="user-meta">
              <span class="role-tag" :style="{ color: getRoleColor(user.role) }">{{ user.role }}</span>
              <span class="separator">·</span>
              <span class="time">{{ timeAgo(user.timestamp) }}</span>
            </span>
            <span class="user-location">{{ formatLocation(user) }}</span>
          </div>

          <div class="user-location-indicator" v-if="user.online">
            <span class="loc-pulse"></span>
          </div>
        </div>
      </TransitionGroup>

      <div v-if="geoStore.users.length === 0" class="empty-state">
        <div class="empty-icon">📍</div>
        <p>Sin usuarios registrados</p>
        <span>Se mostrarán online/offline con su última ubicación</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.users-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: #e2e8f0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 16px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.panel-header h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: #f1f5f9;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon { font-size: 1rem; }

.header-badges {
  display: flex;
  gap: 6px;
  align-items: center;
}

.badge {
  padding: 3px 8px;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.online-badge {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  animation: pulse 2s infinite;
}

.total-badge {
  background: rgba(148, 163, 184, 0.1);
  color: #94a3b8;
}

/* Search bar */
.panel-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 16px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  cursor: pointer;
}

.search-icon { font-size: 0.8rem; opacity: 0.5; }
.search-placeholder { font-size: 0.8rem; color: #64748b; }

/* Users grid */
.users-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}

.users-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.user-card {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition: all 0.25s ease;
}

.user-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateX(4px);
}

.user-card.active {
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.1);
}

.user-card.offline {
  opacity: 0.5;
}

.user-card.offline:hover {
  opacity: 0.7;
}

/* Avatar */
.user-avatar {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 0.8rem;
  font-weight: 700;
  flex-shrink: 0;
  letter-spacing: 0.5px;
}

.avatar-status {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #6b7280;
  border: 2px solid #0f172a;
}

.avatar-status.online {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
}

/* Details */
.user-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.72rem;
}

.role-tag {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.separator { color: #475569; }
.time { color: #64748b; }

.user-location {
  font-size: 0.68rem;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Location indicator */
.user-location-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  flex-shrink: 0;
}

.loc-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3b82f6;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
  animation: locPulse 2s infinite;
}

@keyframes locPulse {
  0%, 100% { box-shadow: 0 0 8px rgba(59, 130, 246, 0.5); }
  50% { box-shadow: 0 0 16px rgba(59, 130, 246, 0.8); }
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0 0 4px;
  font-size: 0.9rem;
  font-weight: 600;
  color: #94a3b8;
}

.empty-state span {
  font-size: 0.75rem;
  color: #64748b;
}

/* Scrollbar */
.users-scroll::-webkit-scrollbar { width: 4px; }
.users-scroll::-webkit-scrollbar-track { background: transparent; }
.users-scroll::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.15); border-radius: 2px; }
.users-scroll::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.25); }

/* List animation */
.user-list-enter-active { transition: all 0.3s ease; }
.user-list-leave-active { transition: all 0.2s ease; }
.user-list-enter-from { opacity: 0; transform: translateX(-20px); }
.user-list-leave-to { opacity: 0; transform: translateX(20px); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@media (max-width: 768px) {
  .panel-header {
    padding: 12px 16px 10px;
  }

  .user-card {
    padding: 8px 10px;
  }

  .user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    font-size: 0.75rem;
  }
}
</style>
