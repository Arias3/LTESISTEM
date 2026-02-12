<script setup lang="ts">
import { useGeoStore } from '../../stores/geo';

const geoStore = useGeoStore();

const getRoleColor = (role: string): string => {
  const roleColors: Record<string, string> = {
    Administrador: '#2d5088',
    Técnico: '#5ba3d0',
    Monitor: '#355c7d',
    Usuario: '#4a90e2',
  };
  return roleColors[role] || '#355c7d';
};

const getRoleIcon = (role: string): string => {
  const roleIcons: Record<string, string> = {
    Administrador: '👨‍💼',
    Técnico: '🔧',
    Monitor: '👀',
    Usuario: '👤',
  };
  return roleIcons[role] || '👤';
};
</script>

<template>
  <div class="users-list-container">
    <div class="list-header">
      <h3>Usuarios Activos</h3>
      <span class="count-badge">{{ geoStore.onlineUsers.length }}</span>
    </div>

    <div class="users-list">
      <div
        v-for="user in geoStore.users"
        :key="user.id"
        class="user-item"
        :class="{ active: geoStore.selectedMarker?.id === user.id }"
        @click="geoStore.selectMarker(user)"
      >
        <div class="user-avatar" :style="{ backgroundColor: getRoleColor(user.role) }">
          {{ getRoleIcon(user.role) }}
        </div>

        <div class="user-info">
          <h4 class="user-name">{{ user.name }}</h4>
          <p class="user-role">{{ user.role }}</p>
        </div>

        <div class="user-status">
          <span class="status-dot" :class="{ online: user.online }"></span>
          <span class="status-text">{{ user.online ? 'En línea' : 'Fuera' }}</span>
        </div>
      </div>

      <div v-if="geoStore.users.length === 0" class="empty-state">
        <p>No hay usuarios activos</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.users-list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8f4f8 100%);
  border-bottom: 1px solid #e2e8f0;
}

.list-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  background: #2d5088;
  color: white;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.users-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.user-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.2s ease;
}

.user-item:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
  transform: translateX(4px);
}

.user-item.active {
  background: #eff6ff;
  border-color: #2d5088;
  box-shadow: 0 2px 8px rgba(45, 80, 136, 0.12);
}

.user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: white;
  font-size: 20px;
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  margin: 0 0 2px 0;
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.user-role {
  margin: 0;
  font-size: 11px;
  color: #6b7280;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.user-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 50px;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  animation: pulse-status 2s infinite;
}

.status-dot.online {
  background: #22c55e;
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.6);
}

.status-text {
  font-size: 10px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #9ca3af;
  font-size: 14px;
}

.empty-state p {
  margin: 0;
}

/* Scrollbar personalizado */
.users-list::-webkit-scrollbar {
  width: 6px;
}

.users-list::-webkit-scrollbar-track {
  background: transparent;
}

.users-list::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 3px;
}

.users-list::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.5);
}

@keyframes pulse-status {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

@media (max-width: 768px) {
  .list-header h3 {
    font-size: 12px;
  }

  .user-item {
    padding: 10px;
    margin-bottom: 6px;
  }

  .user-avatar {
    min-width: 36px;
    width: 36px;
    height: 36px;
    font-size: 16px;
  }

  .user-name {
    font-size: 12px;
  }

  .user-role {
    font-size: 10px;
  }
}
</style>
