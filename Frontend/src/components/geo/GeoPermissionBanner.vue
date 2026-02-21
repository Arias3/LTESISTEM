<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useGeoStore } from '../../stores/geo';

const geoStore = useGeoStore();

const isVisible = computed(() => {
  return geoStore.geoPermission !== 'granted';
});

const statusMessage = computed(() => {
  switch (geoStore.geoPermission) {
    case 'denied':
      return 'Ubicación bloqueada. Habilítala en la configuración de tu navegador para continuar.';
    case 'prompt':
      return 'LTESISTEM necesita tu ubicación para el monitoreo en tiempo real.';
    case 'unknown':
      return 'Se requiere acceso a tu ubicación para el monitoreo en tiempo real.';
    default:
      return '';
  }
});

const isDenied = computed(() => geoStore.geoPermission === 'denied');

const handleRequestPermission = async () => {
  await geoStore.requestGeoPermission();
};

onMounted(() => {
  geoStore.checkGeoPermission();
});
</script>

<template>
  <Transition name="geo-banner">
    <div v-if="isVisible" class="geo-permission-banner" :class="{ denied: isDenied }">
      <div class="banner-content">
        <span class="banner-icon">📍</span>
        <p class="banner-text">{{ statusMessage }}</p>
        <button v-if="!isDenied" class="banner-btn" @click="handleRequestPermission">
          Permitir ubicación
        </button>
        <a
          v-else
          class="banner-link"
          href="https://support.google.com/chrome/answer/142065"
          target="_blank"
          rel="noopener"
        >
          ¿Cómo habilitar?
        </a>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.geo-permission-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9998;
  background: linear-gradient(135deg, #1a73e8, #0d47a1);
  color: #fff;
  padding: 10px 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
  font-family: 'Inter', 'Segoe UI', sans-serif;
}

.geo-permission-banner.denied {
  background: linear-gradient(135deg, #e53935, #b71c1c);
}

.banner-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  max-width: 900px;
  margin: 0 auto;
}

.banner-icon {
  font-size: 1.3rem;
  flex-shrink: 0;
}

.banner-text {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 500;
  line-height: 1.4;
}

.banner-btn {
  flex-shrink: 0;
  padding: 6px 18px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: 1.5px solid rgba(255, 255, 255, 0.5);
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.banner-btn:hover {
  background: rgba(255, 255, 255, 0.35);
  border-color: #fff;
}

.banner-link {
  flex-shrink: 0;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: underline;
  white-space: nowrap;
}

.banner-link:hover {
  opacity: 0.85;
}

/* Transition */
.geo-banner-enter-active,
.geo-banner-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.geo-banner-enter-from,
.geo-banner-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
