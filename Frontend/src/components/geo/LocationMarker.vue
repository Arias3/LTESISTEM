<script setup lang="ts">
import { useGeoStore } from '../../stores/geo';
import type { User, SensorDevice } from '../../stores/geo';
import DeviceInfo from './DeviceInfo.vue';

interface Props {
  marker: User | SensorDevice;
}

defineProps<Props>();

const geoStore = useGeoStore();

const isUser = (marker: any): marker is User => {
  return 'role' in marker;
};

const formatCoordinates = (lat: number, lon: number): string => {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};
</script>

<template>
  <div class="location-marker">
    <div class="marker-content">
      <!-- Información de Usuario -->
      <template v-if="isUser(marker)">
        <div class="marker-header user-header">
          <div class="marker-icon">👤</div>
          <div class="marker-title">
            <h4>{{ marker.name }}</h4>
            <span class="marker-role">{{ marker.role }}</span>
          </div>
          <button class="close-btn" @click="geoStore.deselectMarker">×</button>
        </div>

        <div class="marker-body">
          <div class="info-field">
            <span class="field-label">Estado</span>
            <span class="field-value" :class="{ online: marker.online }">
              {{ marker.online ? '🟢 En línea' : '🔴 Fuera de línea' }}
            </span>
          </div>

          <div class="info-field">
            <span class="field-label">Ubicación</span>
            <span class="field-value coordinates">
              📍 {{ formatCoordinates(marker.location.latitude, marker.location.longitude) }}
            </span>
          </div>

          <div class="info-field">
            <span class="field-label">Última actualización</span>
            <span class="field-value">{{ formatTimestamp(marker.timestamp) }}</span>
          </div>
        </div>
      </template>

      <!-- Información de Dispositivo/Sensor -->
      <template v-else>
        <div class="marker-header device-header">
          <div class="marker-icon">{{ marker.icon }}</div>
          <div class="marker-title">
            <h4>{{ marker.name }}</h4>
            <span class="marker-type">{{ marker.type }}</span>
          </div>
          <button class="close-btn" @click="geoStore.deselectMarker">×</button>
        </div>

        <div class="marker-body">
          <div class="info-field">
            <span class="field-label">Estado</span>
            <span class="field-value" :class="{ online: marker.status === 'online' }">
              {{ marker.status === 'online' ? '🟢 Conectado' : '🔴 Desconectado' }}
            </span>
          </div>

          <div class="info-field">
            <span class="field-label">Ubicación</span>
            <span class="field-value coordinates">
              📍 {{ formatCoordinates(marker.location.latitude, marker.location.longitude) }}
            </span>
          </div>

          <DeviceInfo :device="(marker as SensorDevice)" />

          <div class="info-field">
            <span class="field-label">Última actualización</span>
            <span class="field-value">{{ formatTimestamp(marker.timestamp) }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.location-marker {
  position: absolute;
  bottom: 20px;
  left: 20px;
  z-index: 1000;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.marker-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 320px;
  overflow: hidden;
}

.marker-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.marker-header.user-header {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
}

.marker-header.device-header {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
}

.marker-icon {
  font-size: 28px;
  min-width: 32px;
  line-height: 1;
}

.marker-title {
  flex: 1;
  min-width: 0;
}

.marker-title h4 {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.marker-role,
.marker-type {
  font-size: 11px;
  color: #6b7280;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.close-btn {
  position: relative;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 18px;
  cursor: pointer;
  transition: color 0.2s ease;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #ef4444;
}

.marker-body {
  padding: 16px;
  font-size: 13px;
}

.info-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.info-field:last-child {
  margin-bottom: 0;
}

.field-label {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.field-value {
  font-size: 13px;
  font-weight: 500;
  color: #1f2937;
}

.field-value.online {
  color: #22c55e;
  font-weight: 600;
}

.field-value.coordinates {
  font-family: monospace;
  font-size: 12px;
  color: #2d5088;
  word-break: break-all;
}

@media (max-width: 640px) {
  .location-marker {
    bottom: 10px;
    left: 10px;
    right: 10px;
  }

  .marker-content {
    max-width: none;
  }

  .marker-header {
    padding: 12px;
  }

  .marker-body {
    padding: 12px;
  }

  .marker-title h4 {
    font-size: 13px;
  }
}
</style>
