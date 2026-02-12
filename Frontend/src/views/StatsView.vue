<script setup lang="ts">
import { useAuthStore } from "../stores/auth";
import { ref } from "vue";
import MosaicTile from "../components/MosaicTile.vue";
import WeatherTile from "../components/WeatherTile.vue";

const auth = useAuthStore();

// Estados de los sensores (en tiempo real)
const sensorData = ref({
  temperature: 32,
  humidity: 65,
  motion: false,
  alarm: true,
  camera: "online",
});

// Simulación de datos en tiempo real
setInterval(() => {
  sensorData.value.temperature = 28 + Math.random() * 6;
  sensorData.value.humidity = 55 + Math.random() * 30;
  sensorData.value.motion = Math.random() > 0.7;
}, 3000);
</script>

<template>
  <div class="stats-view">
    <!-- Header -->
    <div class="view-header">
      <div class="header-content">
        <h1>Bienvenido, {{ auth.user?.name }} </h1>
      </div>
    </div>

    <!-- Contenido principal -->
    <main class="dashboard-content">
      <!-- Grid de mosaicos -->
      <div class="mosaic-grid">
        <!-- Mosaico Clima (2x2) -->
        <WeatherTile />

        <!-- Mosaico Temperatura (1x1) -->
        <MosaicTile
          title="Temperatura Interior"
          icon="🌡️"
          :value="sensorData.temperature.toFixed(1)"
          unit="°C"
          size="1x1"
          color="#5ba3d0"
          :trend="2.5"
        />

        <!-- Mosaico Detector de Movimiento (1x1) -->
        <MosaicTile
          title="Movimiento"
          icon="📡"
          :size="'1x1'"
          :color="sensorData.motion ? '#27ae60' : '#2d5088'"
        >
          <div class="motion-indicator">
            <div class="motion-status" :class="{ active: sensorData.motion }">
              <span class="pulse"></span>
              <span v-if="sensorData.motion" class="status-text">Detectado</span>
              <span v-else class="status-text">Inactivo</span>
            </div>
          </div>
        </MosaicTile>

        <!-- Mosaico Humedad (1x1) -->
        <MosaicTile
          title="Humedad"
          icon="💧"
          :value="sensorData.humidity.toFixed(0)"
          unit="%"
          size="1x1"
          color="#355c7d"
          :trend="-1.2"
        />

        <!-- Mosaico Cámara (2x1) -->
        <MosaicTile
          title="Cámara de Seguridad"
          icon="📹"
          size="2x1"
          color="#4a90e2"
        >
          <div class="camera-status">
            <div class="status-indicator" :class="sensorData.camera">
              <span class="dot"></span>
              {{ sensorData.camera.toUpperCase() }}
            </div>
          </div>
        </MosaicTile>

        <!-- Mosaico SOS (2x1) -->
        <MosaicTile
          title="SOS"
          icon="🚨"
          :size="'2x1'"
          color="#e74c3c"
        >
          <div class="sos-button">
            <button class="btn-sos">Activar SOS</button>
            <p class="sos-info">Emergencia: Contacta con los servicios</p>
          </div>
        </MosaicTile>
      </div>
    </main>
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

.stats-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f7fa;
  color: #1e293b;
}

/* Header */
.view-header {
  padding: 12px 20px;
  background: #d8e8ff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.header-content h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  color: #0e1b43;
}

/* Contenido principal */
.dashboard-content {
  flex: 1;
  padding: 32px 40px 40px;
  overflow-y: auto;
  overflow-x: hidden;
  background: #d8e8ff;
}

/* Grid de mosaicos */
.mosaic-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 20px;
  max-width: 100%;
}

/* Contenido específico de mosaicos */
.motion-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.motion-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
}

.motion-status.active {
  background: rgba(255, 255, 255, 0.35);
  animation: pulse-animation 2s infinite;
}

.pulse {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: currentColor;
  display: inline-block;
  animation: blink 1.5s infinite;
}

@keyframes blink {
  0%, 49%, 100% {
    opacity: 1;
  }
  50%, 99% {
    opacity: 0.3;
  }
}

@keyframes pulse-animation {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(255, 255, 255, 0);
  }
}

.status-text {
  font-size: 14px;
  font-weight: 600;
}

/* Cámara */
.camera-status {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
}

.status-indicator.online .dot {
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
}

.status-indicator.offline .dot {
  background: rgba(0, 0, 0, 0.3);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  animation: status-pulse 2s infinite;
}

@keyframes status-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

/* SOS Button */
.sos-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  width: 100%;
  height: 100%;
}

.btn-sos {
  padding: 20px 40px;
  background: linear-gradient(135deg, #cc0000, #990000);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: white;
  border-radius: 10px;
  font-weight: 700;
  font-size: 16px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 2px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.btn-sos:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.btn-sos:active {
  transform: scale(0.98);
}

.sos-info {
  margin: 0;
  font-size: 13px;
  text-align: center;
  opacity: 0.9;
  font-weight: 600;
}

/* Scrollbar personalizado */
.dashboard-content::-webkit-scrollbar {
  width: 6px;
}

.dashboard-content::-webkit-scrollbar-track {
  background: transparent;
}

.dashboard-content::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 3px;
}

.dashboard-content::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.5);
}

/* Responsive */
@media (max-width: 1280px) {
  .mosaic-grid {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }
}

@media (max-width: 768px) {
  .view-header {
    padding: 10px 20px;
  }

  .header-content h1 {
    font-size: 22px;
  }

  .dashboard-content {
    padding: 20px 16px 24px;
  }

  .mosaic-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  /* Hacer que los mosaicos de 2 columnas ocupen solo 1 en móvil */
  .col-span-2 {
    grid-column: span 1 !important;
  }
}

@media (max-width: 480px) {
  .view-header {
    padding: 16px 12px;
  }

  .header-content h1 {
    font-size: 18px;
  }

  .dashboard-content {
    padding: 16px 12px 20px;
  }

  .mosaic-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  /* Hacer que los mosaicos de 2 columnas ocupen solo 1 en móvil */
  .col-span-2 {
    grid-column: span 1 !important;
  }
}</style>
