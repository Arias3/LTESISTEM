<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useGeoStore } from '../../stores/geo';
import LocationMarker from './LocationMarker.vue';

const geoStore = useGeoStore();
const mapContainer = ref<HTMLElement | null>(null);
const map = ref<any>(null);
const markers = ref<Map<string, any>>(new Map());

onMounted(async () => {
  // Verificar si Leaflet está disponible
  const L = (window as any).L;
  if (!L) {
    console.error('Leaflet no está disponible');
    return;
  }

  if (mapContainer.value) {
    // Crear el mapa
    map.value = L.map(mapContainer.value).setView(
      [geoStore.mapCenter.latitude, geoStore.mapCenter.longitude],
      geoStore.mapZoom
    );

    // Añadir tiles de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map.value);

    // Mostradores de marcadores
    updateMarkers();

    // Escuchar cambios en la tienda
    map.value.on('zoomend', () => {
      geoStore.setMapZoom(map.value.getZoom());
    });

    map.value.on('moveend', () => {
      const center = map.value.getCenter();
      geoStore.setMapCenter({
        latitude: center.lat,
        longitude: center.lng,
      });
    });
  }
});

const updateMarkers = () => {
  const L = (window as any).L;
  if (!L || !map.value) return;

  geoStore.allMarkers.forEach((marker) => {
    const markerId = marker.id;

    if (!markers.value.has(markerId)) {
      // Crear nuevo marcador
      const isUser = geoStore.isUser(marker);
      const color = isUser
        ? marker.online
          ? '#3b82f6'
          : '#9ca3af'
        : marker.status === 'online'
          ? '#22c55e'
          : '#ef4444';

      const icon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div style="
            background-color: ${color};
            color: white;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
          ">
            ${isUser ? '👤' : marker.icon || '📍'}
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40],
      });

      const leafletMarker = L.marker(
        [marker.location.latitude, marker.location.longitude],
        { icon }
      )
        .addTo(map.value)
        .on('click', () => {
          geoStore.selectMarker(marker);
        });

      markers.value.set(markerId, leafletMarker);
    } else {
      // Actualizar posición del marcador existente
      const leafletMarker = markers.value.get(markerId);
      leafletMarker.setLatLng([marker.location.latitude, marker.location.longitude]);
    }
  });
};

// Watcher para actualizar marcadores cuando cambian
watch(
  () => geoStore.allMarkers,
  () => {
    updateMarkers();
  },
  { deep: true }
);

// Watcher para centrar el mapa en el marcador seleccionado
watch(
  () => geoStore.selectedMarker,
  (selected) => {
    if (selected && map.value) {
      map.value.setView(
        [selected.location.latitude, selected.location.longitude],
        geoStore.mapZoom + 2
      );
    }
  }
);
</script>

<template>
  <div class="geo-map-container">
    <div ref="mapContainer" class="map-instance"></div>

    <!-- Popup de información del marcador seleccionado -->
    <Transition name="fade">
      <LocationMarker v-if="geoStore.selectedMarker" :marker="geoStore.selectedMarker" />
    </Transition>
  </div>
</template>

<style scoped>
.geo-map-container {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 12px;
  overflow: hidden;
  background: #f5f7fa;
}

.map-instance {
  width: 100%;
  height: 100%;
}

:deep(.leaflet-container) {
  background: #e8f4f8;
  font-family: inherit;
}

:deep(.leaflet-popup-content-wrapper) {
  border-radius: 8px;
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

:deep(.leaflet-popup-tip) {
  background: white;
}

:deep(.custom-marker) {
  animation: markerBounce 0.3s ease-out;
}

@keyframes markerBounce {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
