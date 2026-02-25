<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue';
import { useGeoStore } from '../../stores/geo';
import { useAuthStore } from '../../stores/auth';

const API_URL = import.meta.env.VITE_API_URL;
const geoStore = useGeoStore();
const authStore = useAuthStore();

// State
const searchId = ref('');
const isSearching = ref(false);
const searchResult = ref<any>(null);
const searchError = ref('');
const saveError = ref('');
const showConfig = ref(false);
const selectedDevice = ref<any>(null);
const isSaving = ref(false);
const mapContainer = ref<HTMLElement | null>(null);

let miniMap: any = null;
let miniMarker: any = null;

// Edit form
const editForm = ref({
  name: '',
  description: '',
  type: '',
  latitude: 0,
  longitude: 0,
  samplingInterval: 5,
  programmedBy: '',
});

// Computed
const connectedDevices = computed(() => geoStore.devices);
const hasDevices = computed(() => connectedDevices.value.length > 0);
const allDevices = computed(() => {
  return [...connectedDevices.value].sort((a, b) => {
    if (a.status === 'online' && b.status !== 'online') return -1;
    if (a.status !== 'online' && b.status === 'online') return 1;
    return (b.timestamp || 0) - (a.timestamp || 0);
  });
});
const onlineCount = computed(() => connectedDevices.value.filter(d => d.status === 'online').length);
const totalCount = computed(() => connectedDevices.value.length);

// Search device by hardware ID
const searchDevice = async () => {
  if (!searchId.value.trim()) return;

  isSearching.value = true;
  searchError.value = '';
  searchResult.value = null;

  try {
    // discover es público (sin token)
    const res = await fetch(`${API_URL}/api/devices/discover/${searchId.value.trim()}`);
    const data = await res.json();

    if (data.success) {
      searchResult.value = data;
      if (data.found && data.device) {
        openConfig(data.device);
      }
    } else {
      searchError.value = data.error || 'Error buscando dispositivo';
    }
  } catch {
    searchError.value = 'No se pudo conectar al servidor';
  } finally {
    isSearching.value = false;
  }
};

// Open config panel
const openConfig = (device: any) => {
  selectedDevice.value = device;
  editForm.value = {
    name: device.name || '',
    description: device.description || '',
    type: device.type || 'sensor',
    latitude: device.location?.latitude || 0,
    longitude: device.location?.longitude || 0,
    samplingInterval: device.samplingInterval || 5,
    programmedBy: authStore.user?.name || device.programmedBy || '',
  };
  showConfig.value = true;
};

const setSelectedCoordinates = (lat: number, lng: number) => {
  editForm.value.latitude = Number(lat.toFixed(8));
  editForm.value.longitude = Number(lng.toFixed(8));
};

const destroyMiniMap = () => {
  if (miniMap) {
    miniMap.remove();
    miniMap = null;
    miniMarker = null;
  }
};

const initMiniMap = async () => {
  await nextTick();

  const L = (window as any).L;
  if (!L || !mapContainer.value) return;

  destroyMiniMap();

  const lat = Number(editForm.value.latitude);
  const lng = Number(editForm.value.longitude);
  const hasValidCoords =
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180;

  const startLat = hasValidCoords ? lat : 11.019464;
  const startLng = hasValidCoords ? lng : -74.851522;

  miniMap = L.map(mapContainer.value, {
    zoomControl: true,
    attributionControl: false,
  }).setView([startLat, startLng], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    subdomains: 'abc',
  }).addTo(miniMap);

  miniMarker = L.marker([startLat, startLng], {
    draggable: true,
  }).addTo(miniMap);

  setSelectedCoordinates(startLat, startLng);

  miniMarker.on('dragend', () => {
    const p = miniMarker.getLatLng();
    setSelectedCoordinates(p.lat, p.lng);
  });

  miniMap.on('click', (e: any) => {
    const p = e.latlng;
    miniMarker.setLatLng(p);
    setSelectedCoordinates(p.lat, p.lng);
  });
};

watch(
  () => showConfig.value,
  (open) => {
    if (open) {
      initMiniMap();
    } else {
      destroyMiniMap();
    }
  }
);

watch(
  () => [editForm.value.latitude, editForm.value.longitude],
  ([lat, lng]) => {
    if (!miniMap || !miniMarker) return;

    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;

    const current = miniMarker.getLatLng();
    if (Math.abs(current.lat - latitude) > 1e-8 || Math.abs(current.lng - longitude) > 1e-8) {
      miniMarker.setLatLng([latitude, longitude]);
      miniMap.panTo([latitude, longitude], { animate: true });
    }
  }
);

onUnmounted(() => {
  destroyMiniMap();
});

// Save config
const saveConfig = async () => {
  if (!selectedDevice.value) return;
  isSaving.value = true;
  saveError.value = '';

  try {
    const res = await fetch(`${API_URL}/api/devices/${selectedDevice.value.deviceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(authStore.getAuthHeaders() as Record<string, string>),
      },
      body: JSON.stringify(editForm.value),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || `Error HTTP ${res.status}`);
    }

    if (data.success) {
      selectedDevice.value = data.device;
      showConfig.value = false;
      await geoStore.fetchDevices();
    } else {
      throw new Error(data?.error || 'No se pudo guardar la configuración');
    }
  } catch (error: any) {
    saveError.value = error?.message || 'Error guardando config';
    console.error('Error guardando config:', error);
  } finally {
    isSaving.value = false;
  }
};

// Time ago desde timestamp (ms) o ISO string
const timeAgo = (ts: number | string | undefined): string => {
  if (!ts) return 'desconocido';
  const ms = typeof ts === 'string' ? new Date(ts).getTime() : ts;
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 5)  return 'justo ahora';
  if (s < 60) return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)}m`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)}h`;
  return `hace ${Math.floor(s / 86400)}d`;
};

// lastSeen: preferir lastUpdate (DB) sobre timestamp en memoria
const lastSeen = (device: any): string => {
  return timeAgo(device.lastUpdate || device.timestamp);
};

const formatLocation = (device: any): string => {
  if (!device?.location) return 'sin ubicación';
  const lat = Number(device.location.latitude);
  const lng = Number(device.location.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'sin ubicación';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
};

// Format sensor value
const formatSensorValue = (sensorName: string, sensorObj: any): string => {
  if (!sensorObj) return 'N/A';

  // Si es PIR y tiene 'value' numérico
  if (sensorName === 'pir' || (sensorObj.type === 'pir')) {
    if (sensorObj.detected === true || sensorObj.value === 1) return '✅ ACTIVADO';
    if (sensorObj.detected === false || sensorObj.value === 0) return '❌ DESACTIVADO';
  }

  // Intentar extraer valor del objeto
  if (typeof sensorObj === 'object') {
    if (sensorObj.value !== undefined) return String(sensorObj.value);
    if (sensorObj.detected !== undefined) return sensorObj.detected ? 'Sí' : 'No';
    if (sensorObj.reading !== undefined) return String(sensorObj.reading);
    return '...';
  }

  // Default
  return String(sensorObj);
};

const formatSensor = (data: Record<string, any>) => {
  return Object.entries(data).map(([key, val]) => ({
    name: key,
    value: formatSensorValue(key, val),
    type: val?.type || 'unknown',
    unit: val?.unit || '',
  }));
};
</script>

<template>
  <div class="device-manager">
    <!-- Search bar -->
    <div class="search-bar">
      <input
        v-model="searchId"
        type="text"
        placeholder="Buscar por ID (ej: ESP32-A1B2C3)"
        class="search-input"
        @keyup.enter="searchDevice"
      />
      <button class="search-btn" @click="searchDevice" :disabled="isSearching">
        {{ isSearching ? '⏳' : '🔍' }}
      </button>
    </div>

    <!-- Search result -->
    <div v-if="searchResult" class="search-result" :class="{ found: searchResult.found }">
      <template v-if="searchResult.found">
        <span class="result-icon">✅</span>
        <span>Encontrado: <strong>{{ searchResult.device.name }}</strong></span>
        <button class="config-btn" @click="openConfig(searchResult.device)">⚙️ Config</button>
      </template>
      <template v-else>
        <span class="result-icon">ℹ️</span>
        <span>No registrado. Se creará al conectar el ESP32.</span>
      </template>
    </div>

    <div v-if="searchError" class="search-error">{{ searchError }}</div>

    <!-- Resumen online/offline -->
    <div class="device-summary">
      <span class="summary-online">🟢 {{ onlineCount }} online</span>
      <span class="summary-sep">·</span>
      <span class="summary-total">{{ totalCount }} total</span>
    </div>

    <!-- Connected devices list -->
    <div class="device-list">
      <TransitionGroup name="list">
        <div
          v-for="device in allDevices"
          :key="device.id"
          class="device-card"
          :class="{ offline: device.status === 'offline' }"
          @click="geoStore.selectMarker(device)"
        >
          <div class="card-header">
            <div class="card-left">
              <span class="device-icon" :class="{ 'icon-offline': device.status === 'offline' }">
                {{ device.icon || '📡' }}
              </span>
              <div class="device-info">
                <span class="device-name">{{ device.name }}</span>
                <span class="device-type">{{ device.deviceId || device.type }}</span>
              </div>
            </div>
            <div class="card-right">
              <span class="status-dot" :class="device.status"></span>
              <button class="config-btn-sm" @click.stop="openConfig(device)" title="Configurar">⚙️</button>
            </div>
          </div>

          <!-- Sensor data (solo si hay y está online) -->
          <div v-if="device.status === 'online' && device.sensorData && Object.keys(device.sensorData).length > 0" class="sensor-grid">
            <div
              v-for="sensor in formatSensor(device.sensorData)"
              :key="sensor.name"
              class="sensor-pill"
            >
              <span class="sensor-name">{{ sensor.name }}</span>
              <span class="sensor-value">{{ sensor.value }} <small>{{ sensor.unit }}</small></span>
            </div>
          </div>

          <div class="card-footer">
            <span class="card-time">
              {{ device.status === 'online' ? '🟢 En línea' : '⚫ Última vez: ' + lastSeen(device) }}
            </span>
            <span class="card-location">📍 {{ formatLocation(device) }}</span>
            <span class="card-interval" v-if="device.samplingInterval">
              ⏱ {{ device.samplingInterval }}s
            </span>
          </div>
        </div>
      </TransitionGroup>

      <div v-if="!hasDevices" class="empty-state">
        <span class="empty-icon">📡</span>
        <p>No hay dispositivos conectados</p>
        <p class="empty-hint">Los ESP32 aparecerán aquí al conectarse</p>
      </div>
    </div>

    <!-- Config modal -->
    <Transition name="modal">
      <div v-if="showConfig" class="modal-overlay" @click.self="showConfig = false">
        <div class="modal-content">
          <div class="modal-header">
            <h4>⚙️ Configurar dispositivo</h4>
            <button class="close-x" @click="showConfig = false">✕</button>
          </div>

          <div v-if="selectedDevice" class="modal-body">
            <div v-if="saveError" class="save-error">{{ saveError }}</div>
            <div class="form-row">
              <label>ID Hardware</label>
              <input type="text" :value="selectedDevice.deviceId" disabled class="input-disabled" />
            </div>
            <div class="form-row">
              <label>Nombre</label>
              <input v-model="editForm.name" type="text" />
            </div>
            <div class="form-row">
              <label>Descripción</label>
              <input v-model="editForm.description" type="text" placeholder="Ej: Sensor de puerta principal" />
            </div>
            <div class="form-row">
              <label>Tipo</label>
              <select v-model="editForm.type">
                <option value="sensor">Sensor</option>
                <option value="temperature">Temperatura</option>
                <option value="humidity">Humedad</option>
                <option value="motion">Movimiento (PIR)</option>
                <option value="gateway">Gateway</option>
              </select>
            </div>
            <div class="form-row">
              <label>Ubicación en mapa (clic o arrastra el marcador)</label>
              <div ref="mapContainer" class="mini-map"></div>
              <div class="coords-preview">
                📍 {{ editForm.latitude.toFixed(6) }}, {{ editForm.longitude.toFixed(6) }}
              </div>
            </div>
            <div class="form-row two-col">
              <div>
                <label>Intervalo (s)</label>
                <input v-model.number="editForm.samplingInterval" type="number" min="1" max="300" />
              </div>
              <div>
                <label>Programado por</label>
                <input v-model="editForm.programmedBy" type="text" />
              </div>
            </div>

            <!-- Sensor config display -->
            <div v-if="selectedDevice.sensorConfig && Object.keys(selectedDevice.sensorConfig).length > 0" class="sensor-config-section">
              <label>Sensores configurados</label>
              <div class="sensor-config-list">
                <div v-for="(cfg, key) in selectedDevice.sensorConfig" :key="key" class="sensor-cfg-item">
                  <span class="cfg-name">{{ key }}</span>
                  <span class="cfg-type">{{ (cfg as any).type }}</span>
                  <span class="cfg-pin">Pin {{ (cfg as any).pin }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" @click="showConfig = false">Cancelar</button>
            <button class="btn-save" @click="saveConfig" :disabled="isSaving">
              {{ isSaving ? 'Guardando...' : '💾 Guardar' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.device-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  gap: 10px;
  overflow: hidden;
}

.dm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.dm-header h3 {
  font-size: 0.95rem;
  font-weight: 700;
  color: #e2e8f0;
  margin: 0;
}

.device-count {
  font-size: 0.7rem;
  font-weight: 600;
  color: #22c55e;
  background: rgba(34, 197, 94, 0.12);
  padding: 3px 8px;
  border-radius: 10px;
}

/* Search */
.search-bar {
  display: flex;
  gap: 6px;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 0.8rem;
  outline: none;
  transition: border-color 0.2s;
}

.search-input::placeholder { color: #64748b; }
.search-input:focus { border-color: #3b82f6; }

.search-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: rgba(59, 130, 246, 0.2);
  color: white;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.search-btn:hover { background: rgba(59, 130, 246, 0.35); }

.search-result {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 0.78rem;
  color: #94a3b8;
}

.search-result.found { border-color: rgba(34, 197, 94, 0.2); }
.config-btn {
  margin-left: auto;
  padding: 3px 8px;
  border: none;
  border-radius: 6px;
  background: rgba(59, 130, 246, 0.2);
  color: #93c5fd;
  font-size: 0.72rem;
  cursor: pointer;
}

.search-error {
  font-size: 0.75rem;
  color: #ef4444;
  padding: 4px 0;
}

.mini-map {
  width: 100%;
  height: 220px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.coords-preview {
  margin-top: 8px;
  font-size: 0.78rem;
  color: #93c5fd;
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 8px;
  padding: 6px 8px;
  font-family: 'JetBrains Mono', monospace;
}

.save-error {
  font-size: 0.78rem;
  color: #f87171;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 8px;
  padding: 8px 10px;
}

/* Device list */
.device-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.device-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.device-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(59, 130, 246, 0.2);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.device-icon { font-size: 1.2rem; }

.device-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.device-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: #e2e8f0;
}

.device-type {
  font-size: 0.65rem;
  font-weight: 500;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.card-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6b7280;
}

.status-dot.online {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
}

.config-btn-sm {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 0.75rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.config-btn-sm:hover { background: rgba(255, 255, 255, 0.12); }

/* Sensor grid */
.sensor-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.sensor-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 6px;
  font-size: 0.68rem;
}

.sensor-name {
  color: #64748b;
  font-weight: 500;
}

.sensor-value {
  color: #93c5fd;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
}

.sensor-value small {
  font-weight: 400;
  color: #64748b;
  font-size: 0.6rem;
}

.card-footer {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.card-time {
  font-size: 0.65rem;
  color: #475569;
}

.card-location {
  font-size: 0.65rem;
  color: #64748b;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px 0;
  gap: 6px;
}

.empty-icon { font-size: 2rem; opacity: 0.3; }

.empty-state p {
  font-size: 0.8rem;
  color: #64748b;
  margin: 0;
}

.empty-hint {
  font-size: 0.7rem !important;
  color: #475569 !important;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal-content {
  width: 100%;
  max-width: 440px;
  max-height: 85vh;
  background: #1e293b;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.modal-header h4 {
  font-size: 0.95rem;
  font-weight: 700;
  color: #e2e8f0;
  margin: 0;
}

.close-x {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-body {
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-row label {
  font-size: 0.7rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.form-row input,
.form-row select {
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 0.82rem;
  outline: none;
  transition: border-color 0.2s;
}

.form-row input:focus,
.form-row select:focus { border-color: #3b82f6; }

.input-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem !important;
  color: #93c5fd !important;
}

.form-row select {
  appearance: none;
  cursor: pointer;
}

.two-col {
  flex-direction: row !important;
  gap: 10px;
}

.two-col > div {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Sensor config */
.sensor-config-section {
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.sensor-config-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
}

.sensor-cfg-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  font-size: 0.75rem;
}

.cfg-name { color: #e2e8f0; font-weight: 600; flex: 1; }
.cfg-type { color: #93c5fd; }
.cfg-pin { color: #64748b; font-family: monospace; }

/* Modal footer */
.modal-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.btn-cancel, .btn-save {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
}

.btn-save {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
}

.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-save:hover:not(:disabled) { box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3); }

/* Transitions */
.modal-enter-active { transition: all 0.25s ease; }
.modal-leave-active { transition: all 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal-content { transform: scale(0.95) translateY(10px); }

.list-enter-active { transition: all 0.3s ease; }
.list-leave-active { transition: all 0.2s ease; }
.list-enter-from { opacity: 0; transform: translateX(-10px); }
.list-leave-to { opacity: 0; transform: translateX(10px); }
</style>
