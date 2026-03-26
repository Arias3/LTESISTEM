<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

// Interfaces
interface NodeStats {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  transmitPower: number | null;
  downloadFrequency: number | null;
  uploadFrequency: number | null;
  throughput: {
    download: number | null;
    upload: number | null;
  };
  totalDlUsers: number | null;
  totalUlUsers: number | null;
  gpsLocation: {
    latitude: number | null;
    longitude: number | null;
    altitude: number | null;
  };
  signalQuality: number;
  uptime: number;
  temperature: number;
  lastUpdate: number;
}

// Estado
const nodeStats = ref<NodeStats>({
  id: 'NODE-001',
  name: 'Nodo Central Santa Marta',
  status: 'active',
  transmitPower: null,
  downloadFrequency: null,
  uploadFrequency: null,
  throughput: {
    download: null,
    upload: null,
  },
  gpsLocation: {
    latitude: null,
    longitude: null,
    altitude: null,
  },
  totalDlUsers: null,
  totalUlUsers: null,
  signalQuality: 87,
  uptime: 3456789,
  temperature: 42,
  lastUpdate: Date.now(),
});

let pollingInterval: ReturnType<typeof setInterval> | null = null;

// Computed
const statusColor = computed(() => {
  return nodeStats.value.status === 'active' ? '#27ae60' : '#e74c3c';
});

const statusText = computed(() => {
  return nodeStats.value.status === 'active' ? 'Activo' : 'Inactivo';
});

const signalQualityColor = computed(() => {
  const quality = nodeStats.value.signalQuality;
  if (quality >= 80) return '#27ae60';
  if (quality >= 60) return '#f39c12';
  return '#e74c3c';
});

const uptimeFormatted = computed(() => {
  const seconds = nodeStats.value.uptime;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
});

const API_URL = import.meta.env.VITE_API_URL;

// Funciones
const fetchNodeLocation = async () => {
  const response = await fetch(`${API_URL}/api/nodes/location`, { credentials: 'include' });
  if (!response.ok) return;
  const data = await response.json();
  nodeStats.value.gpsLocation = data;
};

const fetchNodeRadio = async () => {
  const response = await fetch(`${API_URL}/api/nodes/radio`, { credentials: 'include' });
  if (!response.ok) return;
  const data = await response.json();
  nodeStats.value.transmitPower     = data.transmitPower;
  nodeStats.value.downloadFrequency = data.downloadFrequency;
  nodeStats.value.uploadFrequency   = data.uploadFrequency;
};

const fetchNodeThroughput = async () => {
  const response = await fetch(`${API_URL}/api/nodes/throughput`, { credentials: 'include' });
  if (!response.ok) return;
  const data = await response.json();
  nodeStats.value.throughput.download = data.dlThroughput;
  nodeStats.value.throughput.upload   = data.ulThroughput;
  nodeStats.value.totalDlUsers        = data.totalDlUsers;
  nodeStats.value.totalUlUsers        = data.totalUlUsers;
};

const fetchNodeStats = async () => {
  // Simulación de actualización de datos (resto de métricas pendientes de API)
  if (nodeStats.value.status === 'active') {
    nodeStats.value.signalQuality = 75 + Math.random() * 20;
    nodeStats.value.temperature = 38 + Math.random() * 8;
    nodeStats.value.uptime += 3;
    nodeStats.value.lastUpdate = Date.now();
  }
};

const startPolling = () => {
  fetchNodeStats();
  fetchNodeThroughput();
  pollingInterval = setInterval(() => {
    fetchNodeStats();
    fetchNodeThroughput();
  }, 3000);
};

const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
};

const getSignalQualityLabel = (quality: number): string => {
  if (quality >= 80) return 'Excelente';
  if (quality >= 60) return 'Buena';
  if (quality >= 40) return 'Regular';
  return 'Pobre';
};

// Lifecycle
onMounted(() => {
  fetchNodeLocation();
  fetchNodeRadio();
  startPolling();
});

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <div class="network-view">

    <!-- Header -->
    <div class="network-header">
      <div class="header-info">
        <h1>{{ nodeStats.name }}</h1>
        <div class="node-id">ID: {{ nodeStats.id }}</div>
      </div>
      <div class="status-badge" :style="{ backgroundColor: statusColor }">
        <span class="status-dot"></span>
        {{ statusText }}
      </div>
    </div>

    <!-- Grid de estadísticas -->
    <div class="stats-grid">
      <!-- Card: Estado General -->
      <div class="stat-card card-large">
        <div class="card-header">
          <h3>Estado General</h3>
          <span class="update-time">Actualizado hace {{ Math.floor((Date.now() - nodeStats.lastUpdate) / 1000) }}s</span>
        </div>
        <div class="card-body">
          <div class="stat-row">
            <span class="stat-label">Calidad de Señal</span>
            <div class="stat-value-group">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: `${nodeStats.signalQuality}%`, backgroundColor: signalQualityColor }"
                ></div>
              </div>
              <span class="stat-value" :style="{ color: signalQualityColor }">
                {{ nodeStats.signalQuality.toFixed(0) }}%
                <span class="stat-unit">{{ getSignalQualityLabel(nodeStats.signalQuality) }}</span>
              </span>
            </div>
          </div>
          <div class="stat-row">
            <span class="stat-label">Tiempo Activo</span>
            <span class="stat-value">{{ uptimeFormatted }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Temperatura</span>
            <span class="stat-value" :class="{ 'warning': nodeStats.temperature > 45 }">
              {{ nodeStats.temperature.toFixed(1) }} <span class="stat-unit">°C</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Card: Potencia y Frecuencia -->
      <div class="stat-card">
        <div class="card-header">
          <h3>Radio Frecuencia</h3>
        </div>
        <div class="card-body">
          <div class="stat-row">
            <span class="stat-label">Potencia TX</span>
            <span class="stat-value">{{ nodeStats.transmitPower ?? '--' }}<span v-if="nodeStats.transmitPower !== null" class="stat-unit"> dBm</span></span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Frecuencia DL</span>
            <span class="stat-value">{{ nodeStats.downloadFrequency ?? '--' }}<span v-if="nodeStats.downloadFrequency !== null" class="stat-unit"> MHz</span></span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Frecuencia UL</span>
            <span class="stat-value">{{ nodeStats.uploadFrequency ?? '--' }}<span v-if="nodeStats.uploadFrequency !== null" class="stat-unit"> MHz</span></span>
          </div>
        </div>
      </div>

      <!-- Card: Throughput -->
      <div class="stat-card">
        <div class="card-header">
          <h3>Throughput</h3>
        </div>
        <div class="card-body">
          <div class="throughput-item download">
            <div class="throughput-icon">↓</div>
            <div class="throughput-info">
              <div class="throughput-label">Download</div>
              <div class="throughput-value">{{ nodeStats.throughput.download !== null ? nodeStats.throughput.download.toFixed(1) : '--' }}<span v-if="nodeStats.throughput.download !== null" class="stat-unit"> Mbps</span></div>
              <div class="throughput-users">{{ nodeStats.totalDlUsers !== null ? `${nodeStats.totalDlUsers} usuarios activos` : '--' }}</div>
            </div>
          </div>
          <div class="throughput-divider"></div>
          <div class="throughput-item upload">
            <div class="throughput-icon">↑</div>
            <div class="throughput-info">
              <div class="throughput-label">Upload</div>
              <div class="throughput-value">{{ nodeStats.throughput.upload !== null ? nodeStats.throughput.upload.toFixed(1) : '--' }}<span v-if="nodeStats.throughput.upload !== null" class="stat-unit"> Mbps</span></div>
              <div class="throughput-users">{{ nodeStats.totalUlUsers !== null ? `${nodeStats.totalUlUsers} usuarios activos` : '--' }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Card: Ubicación GPS -->
      <div class="stat-card card-large">
        <div class="card-header">
          <h3>Ubicación GPS</h3>
        </div>
        <div class="card-body">
          <div class="gps-info">
            <div class="gps-icon">📍</div>
            <div class="gps-details">
              <div class="gps-coords">
                <div class="coord-row">
                  <span class="coord-label">Latitud:</span>
                  <span class="coord-value">{{ nodeStats.gpsLocation.latitude !== null ? `${nodeStats.gpsLocation.latitude.toFixed(6)}°` : '--' }}</span>
                </div>
                <div class="coord-row">
                  <span class="coord-label">Longitud:</span>
                  <span class="coord-value">{{ nodeStats.gpsLocation.longitude !== null ? `${nodeStats.gpsLocation.longitude.toFixed(6)}°` : '--' }}</span>
                </div>
                <div class="coord-row">
                  <span class="coord-label">Altitud:</span>
                  <span class="coord-value">{{ nodeStats.gpsLocation.altitude !== null ? `${nodeStats.gpsLocation.altitude} m` : '--' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.network-view {
  width: 100%;
  height: 100%;
  padding: 24px;
  background: #f5f7fa;
  overflow-y: auto;
}

/* Pantalla de carga */
.loading-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 20px;
}

.loading-spinner {
  width: 52px;
  height: 52px;
  border: 4px solid #e5e7eb;
  border-top-color: #2d5088;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-text {
  font-size: 15px;
  color: #6b7280;
  font-weight: 500;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Header */
.network-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e5e7eb;
}

.header-info h1 {
  font-family: 'Zen', sans-serif;
  font-size: 28px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 4px 0;
}

.node-id {
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 12px;
  color: white;
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.status-dot {
  width: 8px;
  height: 8px;
  background: white;
  border-radius: 50%;
  animation: pulse-dot 2s infinite;
}

@keyframes pulse-dot {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.2);
  }
}

/* Grid de estadísticas */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
}

.stat-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #e5e7eb;
  transition: all 0.3s ease;
}

.stat-card:hover {
  box-shadow: 0 4px 16px rgba(45, 80, 136, 0.12);
  transform: translateY(-2px);
}

.card-large {
  grid-column: span 2;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.card-header h3 {
  font-family: 'Zen', sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: #2d5088;
  margin: 0;
}

.update-time {
  font-size: 12px;
  color: #9ca3af;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Stat Row */
.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.stat-label {
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
}

.stat-value.warning {
  color: #f39c12;
}

.stat-unit {
  font-size: 13px;
  font-weight: 500;
  color: #9ca3af;
  margin-left: 2px;
}

.stat-value-group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex: 1;
  max-width: 200px;
}

/* Progress Bar */
.progress-bar {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease, background-color 0.3s ease;
}

/* Throughput */
.throughput-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  border-radius: 12px;
  background: #f9fafb;
}

.throughput-item.download {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
}

.throughput-item.upload {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
}

.throughput-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 12px;
  font-size: 24px;
  font-weight: bold;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.throughput-item.download .throughput-icon {
  color: #2d5088;
}

.throughput-item.upload .throughput-icon {
  color: #27ae60;
}

.throughput-info {
  flex: 1;
}

.throughput-label {
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
  margin-bottom: 4px;
}

.throughput-users {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}

.throughput-value {
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
}

.throughput-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 4px 0;
}

/* GPS Info */
.gps-info {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.gps-icon {
  font-size: 48px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.gps-details {
  flex: 1;
}

.gps-coords {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.coord-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.coord-row.skeleton {
  background: #f3f4f6;
}

.skeleton-label,
.skeleton-value {
  height: 14px;
  border-radius: 6px;
  background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

.skeleton-label { width: 60px; }
.skeleton-value { width: 120px; }

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.coord-label {
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
}

.coord-value {
  font-size: 15px;
  font-weight: 700;
  color: #2d5088;
  font-family: monospace;
}

/* Responsive */
@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .card-large {
    grid-column: span 1;
  }
}

@media (max-width: 768px) {
  .network-view {
    padding: 16px;
  }

  .network-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .header-info h1 {
    font-size: 22px;
  }

  .stats-grid {
    gap: 16px;
  }

  .stat-card {
    padding: 16px;
  }

  .throughput-item {
    flex-direction: column;
    text-align: center;
  }

  .throughput-info {
    width: 100%;
  }

  .gps-info {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
}

@media (max-width: 480px) {
  .network-view {
    padding: 12px;
  }

  .header-info h1 {
    font-size: 20px;
  }

  .stat-value {
    font-size: 16px;
  }

  .throughput-value {
    font-size: 18px;
  }
}
</style>
