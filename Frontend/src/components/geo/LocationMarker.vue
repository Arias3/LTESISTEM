<script setup lang="ts">
import { ref, watch } from 'vue';
import { useGeoStore } from '../../stores/geo';
import { useAuthStore } from '../../stores/auth';
import type { User, SensorDevice } from '../../stores/geo';
import DeviceInfo from './DeviceInfo.vue';

const API_URL = import.meta.env.VITE_API_URL;

interface Props {
  marker: User | SensorDevice;
}

const props = defineProps<Props>();

const geoStore = useGeoStore();
const authStore = useAuthStore();

// Reverse geocoding
const address = ref('Cargando dirección...');
const addressCache = new Map<string, string>();

const reverseGeocode = async (lat: number, lng: number) => {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;

  if (addressCache.has(key)) {
    address.value = addressCache.get(key)!;
    return;
  }

  address.value = 'Cargando dirección...';

  try {
    if (!API_URL) {
      address.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      return;
    }

    const res = await fetch(
      `${API_URL}/api/geo/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
      {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          ...(authStore.getAuthHeaders() as Record<string, string>),
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      const a = data.address || {};

      // Construir dirección legible
      const parts: string[] = [];
      if (a.road) parts.push(a.road);
      if (a.house_number) parts[parts.length - 1] += ` #${a.house_number}`;
      if (a.neighbourhood || a.suburb) parts.push(a.neighbourhood || a.suburb);
      if (a.city || a.town || a.village) parts.push(a.city || a.town || a.village);
      if (a.state) parts.push(a.state);

      address.value = parts.length > 0 ? parts.join(', ') : data.display_name || 'Dirección no disponible';
      addressCache.set(key, address.value);
    } else {
      address.value = 'No se pudo obtener la dirección';
    }
  } catch {
    address.value = 'Sin conexión para geocodificar';
  }
};

// Resolver dirección cuando cambia el marcador
watch(
  () => [props.marker.location?.latitude, props.marker.location?.longitude],
  ([lat, lng]) => {
    if (typeof lat === 'number' && typeof lng === 'number') {
      reverseGeocode(lat, lng);
    } else {
      address.value = 'Sin ubicación registrada';
    }
  },
  { immediate: true }
);

const isUser = (marker: any): marker is User => {
  return 'role' in marker;
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const timeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return 'justo ahora';
  if (seconds < 60) return `hace ${seconds}s`;
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)}m`;
  return `hace ${Math.floor(seconds / 3600)}h`;
};
</script>

<template>
  <div class="location-marker">
    <div class="marker-content">
      <!-- User info -->
      <template v-if="isUser(marker)">
        <div class="marker-header">
          <div class="header-left">
            <div class="marker-avatar user-avatar">
              <span>👤</span>
              <span class="avatar-indicator" :class="{ online: marker.online }"></span>
            </div>
            <div class="marker-title">
              <h4>{{ marker.name }}</h4>
              <div class="title-meta">
                <span class="role-chip">{{ marker.role }}</span>
                <span class="status-text" :class="{ online: marker.online }">
                  {{ marker.online ? 'En línea' : 'Desconectado' }}
                </span>
              </div>
            </div>
          </div>
          <button class="close-btn" @click="geoStore.deselectMarker">✕</button>
        </div>

        <div class="marker-body">
          <div class="info-row">
            <span class="info-icon">📍</span>
            <div class="info-content">
              <span class="info-label">Ubicación</span>
              <span class="info-value address-text" :class="{ loading: address === 'Cargando dirección...' }">{{ address }}</span>
            </div>
          </div>

          <div class="info-row">
            <span class="info-icon">🕐</span>
            <div class="info-content">
              <span class="info-label">Última actualización</span>
              <span class="info-value">{{ timeAgo(marker.timestamp) }} · {{ formatTimestamp(marker.timestamp) }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Device info -->
      <template v-else>
        <div class="marker-header">
          <div class="header-left">
            <div class="marker-avatar device-avatar">
              <span>{{ marker.icon || '📡' }}</span>
            </div>
            <div class="marker-title">
              <h4>{{ marker.name }}</h4>
              <div class="title-meta">
                <span class="type-chip">{{ marker.type }}</span>
                <span class="status-text" :class="{ online: marker.status === 'online' }">
                  {{ marker.status === 'online' ? 'Conectado' : 'Desconectado' }}
                </span>
              </div>
            </div>
          </div>
          <button class="close-btn" @click="geoStore.deselectMarker">✕</button>
        </div>

        <div class="marker-body">
          <DeviceInfo :device="(marker as SensorDevice)" />

          <div class="info-row">
            <span class="info-icon">📍</span>
            <div class="info-content">
              <span class="info-label">Ubicación</span>
              <span class="info-value address-text" :class="{ loading: address === 'Cargando dirección...' }">{{ address }}</span>
            </div>
          </div>

          <div class="info-row">
            <span class="info-icon">🕐</span>
            <div class="info-content">
              <span class="info-label">Última actualización</span>
              <span class="info-value">{{ timeAgo(marker.timestamp) }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.location-marker {
  position: absolute;
  bottom: 16px;
  left: 16px;
  z-index: 1000;
  max-width: 360px;
  width: calc(100% - 32px);
}

.marker-content {
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  color: #e2e8f0;
}

/* Header */
.marker-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 14px 14px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.header-left {
  display: flex;
  gap: 10px;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.marker-avatar {
  position: relative;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.user-avatar {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
}

.device-avatar {
  background: linear-gradient(135deg, #22c55e, #15803d);
}

.avatar-indicator {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #6b7280;
  border: 2px solid #0f172a;
}

.avatar-indicator.online {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
}

.marker-title {
  flex: 1;
  min-width: 0;
}

.marker-title h4 {
  margin: 0 0 4px;
  font-size: 0.9rem;
  font-weight: 700;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.title-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.role-chip, .type-chip {
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.role-chip {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.type-chip {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.status-text {
  font-size: 0.7rem;
  font-weight: 600;
  color: #ef4444;
}

.status-text.online {
  color: #22c55e;
}

.close-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
  font-size: 0.8rem;
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

/* Body */
.marker-body {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.info-icon {
  font-size: 0.85rem;
  margin-top: 1px;
  flex-shrink: 0;
}

.info-content {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.info-label {
  font-size: 0.65rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.info-value {
  font-size: 0.8rem;
  font-weight: 500;
  color: #cbd5e1;
}

.info-value.address-text {
  font-size: 0.78rem;
  line-height: 1.4;
  color: #93c5fd;
}

.info-value.address-text.loading {
  color: #64748b;
  font-style: italic;
  animation: loadingPulse 1.5s infinite;
}

@keyframes loadingPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Mobile */
@media (max-width: 768px) {
  .location-marker {
    bottom: 12px;
    left: 12px;
    right: 12px;
    max-width: none;
    width: auto;
  }
}

@media (max-width: 480px) {
  .location-marker {
    bottom: 8px;
    left: 8px;
    right: 8px;
  }

  .marker-header,
  .marker-body {
    padding: 10px 12px;
  }
}
</style>
