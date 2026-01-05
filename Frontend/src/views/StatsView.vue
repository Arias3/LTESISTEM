<script setup lang="ts">
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
</script>

<template>
  <div class="dashboard-container">

    <div class="main-panel">
      <!-- Contenido principal -->
      <main class="dashboard-content">
        <p>Bienvenido {{ auth.user?.name }}</p>

        <!-- Aquí irían tus widgets en tiempo real -->
        <div class="widgets-grid">
          <div class="widget">Temperatura: 32°</div>
          <div class="widget">Humedad: 20%</div>
          <div class="widget">Detección: Activada</div>
          <div class="widget">Cámara de seguridad</div>
          <div class="widget">Estado de alarma: ACTIVA</div>
          <div class="widget">SOS</div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.dashboard-container {
  display: flex;
  height: 100vh;
  width: 100%;
}

.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #1a73e8;
  color: white;
  padding: 10px 20px;
}

.dashboard-content {
  flex: 1;
  padding: 20px;
  background-color: #f0f4f8;
  overflow-y: auto;
}

.widgets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 15px;
  margin-top: 20px;
}

.widget {
  background-color: white;
  border-radius: 8px;
  padding: 15px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  font-weight: bold;
}
</style>
