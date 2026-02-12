<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

// Interfaces
interface NodeStats {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  transmitPower: number; // dBm
  downloadFrequency: number; // MHz
  uploadFrequency: number; // MHz
  throughput: {
    download: number; // Mbps
    upload: number; // Mbps
  };
  gpsLocation: {
    latitude: number;
    longitude: number;
    altitude: number; // metros
  };
  signalQuality: number; // 0-100
  uptime: number; // segundos
  temperature: number; // °C
  lastUpdate: number; // timestamp
}

// Estado
const nodeStats = ref<NodeStats>({
  id: 'NODE-001',
  name: 'Nodo Central Santa Marta',
  status: 'active',
  transmitPower: 23.5,
  downloadFrequency: 2450,
  uploadFrequency: 2450,
  throughput: {
    download: 145.2,
    upload: 98.7,
  },
  gpsLocation: {
    latitude: 11.018224,
    longitude: -74.850678,
    altitude: 12,
  },
  signalQuality: 87,
  uptime: 3456789, // ~40 días
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

// Funciones
const fetchNodeStats = async () => {
  // TODO: Implementar llamada real al ACP
  // const response = await fetch(`${API_URL}/api/network/node/${nodeId}`);
  // nodeStats.value = await response.json();
  
  // Simulación de actualización de datos
  if (nodeStats.value.status === 'active') {
    nodeStats.value.throughput.download = 120 + Math.random() * 50;
    nodeStats.value.throughput.upload = 80 + Math.random() * 40;
    nodeStats.value.signalQuality = 75 + Math.random() * 20;
    nodeStats.value.temperature = 38 + Math.random() * 8;
    nodeStats.value.uptime += 3;
    nodeStats.value.lastUpdate = Date.now();
  }
};

const startPolling = () => {
  fetchNodeStats();
  pollingInterval = setInterval(fetchNodeStats, 3000);
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
            <span class="stat-value">{{ nodeStats.transmitPower }} <span class="stat-unit">dBm</span></span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Frecuencia DL</span>
            <span class="stat-value">{{ nodeStats.downloadFrequency }} <span class="stat-unit">MHz</span></span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Frecuencia UL</span>
            <span class="stat-value">{{ nodeStats.uploadFrequency }} <span class="stat-unit">MHz</span></span>
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
              <div class="throughput-value">{{ nodeStats.throughput.download.toFixed(1) }} <span class="stat-unit">Mbps</span></div>
            </div>
          </div>
          <div class="throughput-divider"></div>
          <div class="throughput-item upload">
            <div class="throughput-icon">↑</div>
            <div class="throughput-info">
              <div class="throughput-label">Upload</div>
              <div class="throughput-value">{{ nodeStats.throughput.upload.toFixed(1) }} <span class="stat-unit">Mbps</span></div>
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
                  <span class="coord-value">{{ nodeStats.gpsLocation.latitude.toFixed(6) }}°</span>
                </div>
                <div class="coord-row">
                  <span class="coord-label">Longitud:</span>
                  <span class="coord-value">{{ nodeStats.gpsLocation.longitude.toFixed(6) }}°</span>
                </div>
                <div class="coord-row">
                  <span class="coord-label">Altitud:</span>
                  <span class="coord-value">{{ nodeStats.gpsLocation.altitude }} m</span>
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
  font-family: 'Inter', system-ui, sans-serif;
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
