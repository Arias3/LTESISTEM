<script setup lang="ts">
import { useUIStore } from "../stores/ui";

const ui = useUIStore();
</script>

<template>
  <div v-if="ui.showNotifications" class="popup">
    <header>
      <h4>Notificaciones</h4>
      <button @click="ui.closeNotifications">✕</button>
    </header>

    <section>
      <p>No tienes notificaciones nuevas</p>
    </section>
  </div>
</template>

<style scoped>
.popup {
  position: absolute;
  top: 20px;
  left: 70px;
  width: 320px;
  background: white;
  color: #222;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
  z-index: 1000;
}

header {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid #eee;
}
</style>
