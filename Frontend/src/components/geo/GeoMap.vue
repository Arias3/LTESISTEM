<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useGeoStore } from '../../stores/geo';
import LocationMarker from './LocationMarker.vue';

const geoStore = useGeoStore();
const mapContainer = ref<HTMLElement | null>(null);
const map = ref<any>(null);
const markers = ref<Map<string, any>>(new Map());

// Theme toggle — dos capas pre-creadas, cada una con sus subdomains correctos
const isDark = ref(true);
let darkLayer: any = null;
let lightLayer: any = null;

const toggleTheme = () => {
  if (!map.value) return;
  isDark.value = !isDark.value;
  if (isDark.value) {
    map.value.removeLayer(lightLayer);
    map.value.addLayer(darkLayer);
  } else {
    map.value.removeLayer(darkLayer);
    map.value.addLayer(lightLayer);
  }
};

onMounted(async () => {
  const L = (window as any).L;
  if (!L) {
    console.error('Leaflet no está disponible');
    return;
  }

  if (mapContainer.value) {
    map.value = L.map(mapContainer.value, {
      zoomControl: false,
    }).setView(
      [geoStore.mapCenter.latitude, geoStore.mapCenter.longitude],
      geoStore.mapZoom
    );

    L.control.zoom({ position: 'bottomleft' }).addTo(map.value);

    // Crear ambas capas con sus configs correctas
    darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://osm.org/">OSM</a>',
      maxZoom: 19,
      subdomains: 'abcd',
    });

    lightLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org/">OpenStreetMap</a>',
      maxZoom: 19,
      subdomains: 'abc',
    });

    // Mostrar la capa oscura por defecto
    darkLayer.addTo(map.value);

    updateMarkers();

    map.value.on('zoomend', () => {
      if (map.value) geoStore.setMapZoom(map.value.getZoom());
    });

    map.value.on('moveend', () => {
      if (map.value) {
        const center = map.value.getCenter();
        geoStore.setMapCenter({ latitude: center.lat, longitude: center.lng });
      }
    });
  }
});

onUnmounted(() => {
  if (map.value) {
    map.value.remove();
    map.value = null;
    darkLayer = null;
    lightLayer = null;
  }
});

const updateMarkers = () => {
  const L = (window as any).L;
  if (!L || !map.value) return;

  const validMarkers = geoStore.allMarkers.filter((m) => geoStore.hasValidLocation(m));
  const currentIds = new Set(validMarkers.map(m => m.id));

  for (const [id, marker] of markers.value.entries()) {
    if (!currentIds.has(id)) {
      map.value.removeLayer(marker);
      markers.value.delete(id);
    }
  }

  validMarkers.forEach((marker) => {
    const markerId = marker.id;
    const isUser = geoStore.isUser(marker);
    const isOnline = isUser ? marker.online : marker.status === 'online';

    const color = isUser
      ? marker.online ? '#3b82f6' : '#6b7280'
      : marker.status === 'online' ? '#22c55e' : '#ef4444';

    const pulseColor = isUser ? '59, 130, 246' : '34, 197, 94';

    if (!markers.value.has(markerId)) {
      const icon = L.divIcon({
        className: 'custom-marker-wrapper',
        html: `
          <div class="marker-outer ${isOnline ? 'online' : 'offline'}">
            ${isOnline ? `<div class="marker-pulse" style="--pulse-color: ${pulseColor}"></div>` : ''}
            <div class="marker-dot" style="background: ${color}; box-shadow: 0 0 12px ${color}80;">
              <span class="marker-emoji">${isUser ? '👤' : marker.icon || '📡'}</span>
            </div>
          </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });

      const leafletMarker = L.marker(
        [marker.location!.latitude, marker.location!.longitude],
        { icon }
      )
        .addTo(map.value)
        .on('click', () => {
          geoStore.selectMarker(marker);
        });

      markers.value.set(markerId, leafletMarker);
    } else {
      const leafletMarker = markers.value.get(markerId);
      const currentLatLng = leafletMarker.getLatLng();
      if (currentLatLng.lat !== marker.location!.latitude || currentLatLng.lng !== marker.location!.longitude) {
        leafletMarker.setLatLng([marker.location!.latitude, marker.location!.longitude]);
      }
    }
  });
};

watch(
  () => geoStore.allMarkers,
  () => { updateMarkers(); },
  { deep: true }
);

// Usar setView (no flyTo) para evitar crash por animación interrumpida
watch(
  () => geoStore.selectedMarker,
  (selected) => {
    if (selected && selected.location && map.value) {
      map.value.setView(
        [selected.location.latitude, selected.location.longitude],
        Math.max(geoStore.mapZoom, 15),
        { animate: true, duration: 0.5 }
      );
    }
  }
);

const centerOnUser = () => {
  if (geoStore.userLocation && map.value) {
    map.value.setView(
      [geoStore.userLocation.latitude, geoStore.userLocation.longitude],
      16,
      { animate: true, duration: 0.5 }
    );
  }
};
</script>

<template>
  <div class="geo-map-container" :class="{ 'light-mode': !isDark }">
    <div ref="mapContainer" class="map-instance"></div>

    <!-- Map controls -->
    <div class="map-controls">
      <!-- Theme toggle -->
      <button class="control-btn theme-toggle" @click="toggleTheme" :title="isDark ? 'Modo claro' : 'Modo oscuro'">
        <span class="toggle-track" :class="{ active: !isDark }">
          <span class="toggle-thumb">
            {{ isDark ? '🌙' : '☀️' }}
          </span>
        </span>
      </button>

      <!-- Center on me -->
      <button class="control-btn center-btn" @click="centerOnUser" title="Mi ubicación">
        <span>📍</span>
      </button>
    </div>

    <!-- Popup de marcador seleccionado -->
    <Transition name="slide-up">
      <LocationMarker v-if="geoStore.selectedMarker" :marker="geoStore.selectedMarker" />
    </Transition>
  </div>
</template>

<style scoped>
.geo-map-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.map-instance {
  width: 100%;
  height: 100%;
}

/* Dark theme overrides for Leaflet */
:deep(.leaflet-container) {
  background: #1a1a2e;
  font-family: 'Inter', 'Segoe UI', sans-serif;
}

.light-mode :deep(.leaflet-container) {
  background: #e8f0f6;
}

:deep(.leaflet-control-zoom) {
  border: none !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
}

:deep(.leaflet-control-zoom a) {
  background: rgba(15, 23, 42, 0.9) !important;
  color: #e2e8f0 !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  backdrop-filter: blur(12px);
  width: 36px !important;
  height: 36px !important;
  line-height: 36px !important;
  font-size: 16px !important;
}

:deep(.leaflet-control-zoom a:hover) {
  background: rgba(59, 130, 246, 0.3) !important;
}

:deep(.leaflet-control-attribution) {
  background: rgba(15, 23, 42, 0.7) !important;
  color: #64748b !important;
  font-size: 10px !important;
  backdrop-filter: blur(8px);
}

:deep(.leaflet-control-attribution a) {
  color: #94a3b8 !important;
}

/* Marker styles */
:deep(.custom-marker-wrapper) {
  background: none !important;
  border: none !important;
}

:deep(.marker-outer) {
  position: relative;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.marker-pulse) {
  position: absolute;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(var(--pulse-color), 0.2);
  animation: markerPulse 2s infinite;
}

:deep(.marker-dot) {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid rgba(255, 255, 255, 0.9);
  cursor: pointer;
  z-index: 1;
  transition: transform 0.2s ease;
}

:deep(.marker-dot:hover) {
  transform: scale(1.15);
}

:deep(.marker-emoji) {
  font-size: 16px;
  line-height: 1;
}

:deep(.marker-outer.offline .marker-dot) {
  opacity: 0.5;
  filter: grayscale(0.5);
}

@keyframes markerPulse {
  0% { transform: scale(0.8); opacity: 0.6; }
  50% { transform: scale(1.3); opacity: 0; }
  100% { transform: scale(0.8); opacity: 0; }
}

/* Map controls group */
.map-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-btn {
  width: 42px;
  height: 42px;
  border: none;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: white;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.25s ease;
}

.light-mode .control-btn {
  background: rgba(255, 255, 255, 0.92);
  border-color: rgba(0, 0, 0, 0.08);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.control-btn:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
}

.control-btn:active {
  transform: scale(0.95);
}

/* Theme toggle — needs auto width AND height to not be clipped by .control-btn */
.theme-toggle {
  width: auto;
  height: auto;
  padding: 6px;
}

.toggle-track {
  display: flex;
  align-items: center;
  width: 52px;
  height: 28px;
  background: #1e293b;
  border-radius: 14px;
  padding: 3px;
  transition: background 0.3s ease;
  position: relative;
}

.toggle-track.active {
  background: #fbbf24;
}

.toggle-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  font-size: 0.75rem;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: translateX(0);
}

.toggle-track.active .toggle-thumb {
  transform: translateX(24px);
  background: rgba(255, 255, 255, 0.3);
}

/* Light mode overrides */
.light-mode :deep(.leaflet-control-zoom a) {
  background: rgba(255, 255, 255, 0.95) !important;
  color: #1e293b !important;
  border-color: rgba(0, 0, 0, 0.08) !important;
}

.light-mode :deep(.leaflet-control-attribution) {
  background: rgba(255, 255, 255, 0.85) !important;
  color: #64748b !important;
}

/* Transitions */
.slide-up-enter-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.slide-up-leave-active {
  transition: all 0.2s ease;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(30px) scale(0.95);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

@media (max-width: 768px) {
  .map-controls {
    top: 60px;
    right: 10px;
  }

  .control-btn {
    width: 38px;
    height: 38px;
    border-radius: 10px;
  }

  /* Override fixed height for toggle on mobile */
  .theme-toggle {
    width: auto;
    height: auto;
    padding: 5px;
  }

  .toggle-track {
    width: 46px;
    height: 24px;
    border-radius: 12px;
    padding: 2px;
  }

  .toggle-thumb {
    width: 20px;
    height: 20px;
    font-size: 0.65rem;
  }

  .toggle-track.active .toggle-thumb {
    transform: translateX(22px);
  }

  :deep(.leaflet-control-zoom a) {
    width: 32px !important;
    height: 32px !important;
    line-height: 32px !important;
    font-size: 14px !important;
  }
}
</style>
