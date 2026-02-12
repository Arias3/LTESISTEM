<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useGeoStore } from '../stores/geo';
import GeoMap from '../components/geo/GeoMap.vue';
import UsersList from '../components/geo/UsersList.vue';

const geoStore = useGeoStore();

onMounted(async () => {
  // Obtener ubicación del usuario
  await geoStore.getUserLocation();

  // Iniciar polling de datos (o mock si no hay backend)
  if (import.meta.env.VITE_API_URL) {
    // Usar endpoints reales con polling
    await geoStore.startPolling();
  } else {
    // Usar datos mock para desarrollo
    geoStore.initializeMockUsers();
    geoStore.initializeMockDevices();
    
    // Simular actualización de datos en tiempo real
    setInterval(() => {
      geoStore.users.forEach((user) => {
        if (user.online) {
          user.location.latitude += (Math.random() - 0.5) * 0.001;
          user.location.longitude += (Math.random() - 0.5) * 0.001;
          user.timestamp = Date.now();
        }
      });
    }, 5000);
  }
});

onUnmounted(() => {
  // Detener polling al salir de la vista
  geoStore.stopPolling();
});
</script>

<template>
  <div class="geo-view">
    <div class="geo-container">
      <!-- Lista de usuarios (lado izquierdo) -->
      <aside class="geo-sidebar">
        <UsersList />
      </aside>

      <!-- Mapa (lado derecho, ocupa más espacio) -->
      <main class="geo-main">
        <GeoMap />
      </main>
    </div>
  </div>
</template>

<style scoped>
.geo-view {
  display: flex;
  width: 100%;
  height: 100%;
}

.geo-container {
  display: flex;
  width: 100%;
  height: 100%;
  gap: 16px;
  padding: 16px;
  background: #f5f7fa;
  overflow: hidden;
}

.geo-sidebar {
  width: 300px;
  height: 100%;
  flex-shrink: 0;
  overflow: hidden;
}

.geo-main {
  flex: 1;
  height: 100%;
  min-width: 0;
  overflow: hidden;
}

@media (max-width: 1024px) {
  .geo-container {
    gap: 12px;
    padding: 12px;
  }

  .geo-sidebar {
    width: 250px;
  }
}

@media (max-width: 768px) {
  .geo-container {
    flex-direction: column;
    gap: 12px;
    padding: 12px;
  }

  .geo-sidebar {
    width: 100%;
    height: 200px;
    flex-shrink: 1;
  }

  .geo-main {
    flex: 1;
    height: 100%;
  }
}

@media (max-width: 480px) {
  .geo-container {
    gap: 8px;
    padding: 8px;
  }

  .geo-sidebar {
    height: 150px;
  }
}
</style>
