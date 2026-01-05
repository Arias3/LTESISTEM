<template>
  <div class="dashboard-layout">
    <Sidebar />

    <!-- Llamada entrante -->
    <IncomingCallModal v-if="call.state === 'ringing'" />

    <!-- Llamada activa (incluye llamando y en llamada) -->
    <ActiveCall v-if="call.state === 'in-call' || call.state === 'calling'" />

    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import Sidebar from "../components/Sidebar.vue";
import { useCallStore } from "../stores/call";

import IncomingCallModal from "../components/Calls/IncomingCallModal.vue";
import ActiveCall from "../components/Calls/ActiveCall.vue";

const call = useCallStore();
</script>

<style scoped>
.dashboard-layout {
  display: flex;
  height: 100vh;
  position: relative;
}

.content {
  flex: 1;
  overflow: hidden;
}

/* Asegurar que el overlay de llamada esté por encima de todo */
.call-overlay {
  z-index: 9999;
}
</style>