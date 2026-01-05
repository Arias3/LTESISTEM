<script setup lang="ts">
import { computed, ref, watch, onUnmounted, onMounted } from "vue";
import { useCallStore } from "../../stores/call";

const call = useCallStore();
const ringtoneAudio = ref<HTMLAudioElement | null>(null);
const audioContext = ref<AudioContext | null>(null);

// Inicializar al montar
onMounted(() => {
  // Crear AudioContext (necesario para fallback)
  if (typeof window !== "undefined") {
    audioContext.value = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
  }
});

// Observar cuando llega una llamada
watch(
  () => call.state,
  (state) => {
    if (state === "ringing") {
      // Esperar un momento para que el DOM esté listo
      setTimeout(() => {
        playRingtone();
      }, 100);
    } else {
      stopRingtone();
    }
  },
  { immediate: true }
);

const playRingtone = () => {
  // Primero intentar con archivo de audio
  if (ringtoneAudio.value) {
    playWithAudioElement();
  } else {
    // Fallback a tono generado
    playFallbackTone();
  }
};

const playWithAudioElement = () => {
  if (!ringtoneAudio.value) return;
  try {
    // Configurar audio
    ringtoneAudio.value.loop = true;
    ringtoneAudio.value.volume = 0.7;

    // Reiniciar si ya estaba reproduciendo
    ringtoneAudio.value.currentTime = 0;

    // Intentar reproducir
    const playPromise = ringtoneAudio.value.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
        })
        .catch((error) => {
          console.warn("❌ Error con elemento audio:", error);
          // Fallback
          playFallbackTone();
        });
    }
  } catch (error) {
    console.error("❌ Excepción con audio:", error);
    playFallbackTone();
  }
};

const playFallbackTone = () => {
  try {
    if (!audioContext.value) {
      audioContext.value = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }

    const ctx = audioContext.value;
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    // Crear oscilador para tono de teléfono tradicional
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Configurar tono
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);

    // Patrón: 1s sonido, 2s silencio (como teléfono real)
    const startTime = ctx.currentTime;

    // Sonar por 1 segundo
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, startTime + 0.9);
    gainNode.gain.linearRampToValueAtTime(0, startTime + 1.0);

    // Silencio por 2 segundos
    gainNode.gain.setValueAtTime(0, startTime + 3.0);

    oscillator.start();

    // Repetir cada 3 segundos
    const interval = setInterval(() => {
      if (call.state !== "ringing") {
        clearInterval(interval);
        return;
      }

      const time = ctx.currentTime;
      gainNode.gain.setValueAtTime(0, time);
      gainNode.gain.linearRampToValueAtTime(0.3, time + 0.1);
      gainNode.gain.setValueAtTime(0.3, time + 0.9);
      gainNode.gain.linearRampToValueAtTime(0, time + 1.0);
    }, 3000);

    // Guardar referencia para limpiar
    (window as any).__ringtone = { oscillator, interval };

    console.log("✅ Tono generado activado");
  } catch (error) {
    console.error("❌ Error con tono generado:", error);
    vibrateAsLastResort();
  }
};

const vibrateAsLastResort = () => {
  if ("vibrate" in navigator) {
    console.log("📳 Activando vibración");
    // Patrón: vibrar 1s, pausa 0.5s, vibrar 1s
    navigator.vibrate([1000, 500, 1000, 500, 1000]);
  }
};

const stopRingtone = () => {

  // Detener elemento de audio
  if (ringtoneAudio.value) {
    ringtoneAudio.value.pause();
    ringtoneAudio.value.currentTime = 0;
  }

  // Detener tono generado
  if ((window as any).__ringtone) {
    const { oscillator, interval } = (window as any).__ringtone;
    try {
      oscillator.stop();
    } catch (e) {}
    clearInterval(interval);
    delete (window as any).__ringtone;
  }

  // Detener AudioContext
  if (audioContext.value) {
    audioContext.value.close().catch(() => {});
    audioContext.value = null;
  }

  // Detener vibración
  if ("vibrate" in navigator) {
    navigator.vibrate(0);
  }
};

const incoming = computed(() => call.incomingCall);
const modeLabel = computed(() =>
  incoming.value?.mode === "video" ? "Videollamada" : "Llamada de voz"
);

const callerLabel = computed(() => incoming.value?.callerName ?? "Usuario");

const accept = () => {
  if (!incoming.value) return;
  stopRingtone();
  call.acceptCall();
};

const reject = () => {
  stopRingtone();
  call.rejectCall();
};

// Limpiar al desmontar
onUnmounted(() => {
  stopRingtone();
});
</script>
<template>
  <div v-if="call.state === 'ringing'" class="call-overlay">

     <audio 
      ref="ringtoneAudio" 
      preload="auto"
      class="hidden-audio"
      @loadeddata="console.log('🎵 Audio cargado')"
      @error="(e) => console.error('❌ Error cargando audio:', e)"
    >
      <!-- PRUEBA PRIMERO CON ESTE TONO ONLINE -->
      <source src="/sounds/tone.wav" type="audio/wav" />
    </audio>
    <div class="call-card">
      <!-- Header -->
      <div class="call-header">
        <div class="call-type">
          <svg
            v-if="modeLabel === 'Videollamada'"
            class="call-type-icon"
            viewBox="0 0 24 24"
          >
            <path
              d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"
            />
          </svg>
          <svg v-else class="call-type-icon" viewBox="0 0 24 24">
            <path
              d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
            />
          </svg>
        </div>
        <p class="caller">{{ callerLabel }}</p>
      </div>

      <!-- Body -->
      <div class="call-body">
        <div class="avatar">
          {{ callerLabel.charAt(0).toUpperCase() }}
        </div>
        <div class="ringing-indicator">
          <div class="ring-circle"></div>
          <div class="ring-circle"></div>
          <div class="ring-circle"></div>
          <p class="ringing-text">Llamada entrante</p>
        </div>
      </div>

      <!-- Actions -->
      <div class="call-actions">
        <button class="btn accept" @click="accept">
          <svg class="btn-icon" viewBox="0 0 24 24">
            <path
              d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"
            />
          </svg>
        </button>

        <button class="btn reject" @click="reject">
          <svg class="btn-icon" viewBox="0 0 24 24">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ========== OVERLAY ========== */
.call-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* ========== CARD ========== */
.call-card {
  background: linear-gradient(135deg, #5e68dc, #345ba9);
  border-radius: 24px;
  padding: 32px 24px;
  width: 100%;
  max-width: 340px;
  text-align: center;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  animation: slideUp 0.4s ease;
  position: relative;
  overflow: hidden;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.call-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
}

/* ========== HEADER ========== */
.call-header {
  margin-bottom: 32px;
}

.call-type {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.call-type-icon {
  width: 32px;
  height: 32px;
  fill: rgba(255, 255, 255, 0.9);
}

.caller {
  margin: 0;
  font-size: 24px;
  color: white;
  font-weight: 600;
  line-height: 1.3;
}

/* ========== BODY ========== */
.call-body {
  margin-bottom: 40px;
}

.avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  color: #345ba9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: bold;
  margin: 0 auto 32px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}

.ringing-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  position: relative;
}

.ring-circle {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.8);
  position: relative;
  animation: pulseRing 1.5s infinite;
}

.ring-circle:nth-child(2) {
  animation-delay: 0.2s;
  position: absolute;
}

.ring-circle:nth-child(3) {
  animation-delay: 0.4s;
  position: absolute;
}

@keyframes pulseRing {
  0% {
    transform: scale(0.8);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.4;
  }
  100% {
    transform: scale(0.8);
    opacity: 0.8;
  }
}

.ringing-text {
  margin: 0;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
  letter-spacing: 0.5px;
}

.hidden-audio {
  display: none;
  visibility: hidden;
  position: absolute;
  opacity: 0;
}

/* ========== ACTIONS ========== */
.call-actions {
  display: flex;
  justify-content: center;
  gap: 24px;
}

.btn {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
}

.btn:active {
  transform: translateY(0);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.btn.accept {
  background: linear-gradient(135deg, #4caf50, #2e7d32);
}

.btn.reject {
  background: linear-gradient(135deg, #f44336, #c62828);
}

.btn-icon {
  width: 28px;
  height: 28px;
  fill: white;
}

/* ========== RESPONSIVE ========== */
@media (max-width: 480px) {
  .call-card {
    padding: 28px 20px;
    max-width: 300px;
  }

  .avatar {
    width: 100px;
    height: 100px;
    font-size: 40px;
  }

  .caller {
    font-size: 22px;
  }

  .btn {
    width: 60px;
    height: 60px;
  }

  .btn-icon {
    width: 26px;
    height: 26px;
  }
}

@media (max-width: 320px) {
  .call-card {
    padding: 24px 16px;
    max-width: 280px;
  }

  .avatar {
    width: 90px;
    height: 90px;
    font-size: 36px;
  }

  .caller {
    font-size: 20px;
  }

  .call-actions {
    gap: 20px;
  }

  .btn {
    width: 56px;
    height: 56px;
  }
}

/* ========== PANTALLAS GRANDES ========== */
@media (min-width: 768px) {
  .call-card {
    max-width: 380px;
    padding: 40px 32px;
  }

  .avatar {
    width: 140px;
    height: 140px;
    font-size: 56px;
  }

  .caller {
    font-size: 28px;
  }

  .btn {
    width: 70px;
    height: 70px;
  }

  .btn-icon {
    width: 32px;
    height: 32px;
  }
}

/* ========== ORIENTACIÓN HORIZONTAL ========== */
@media (orientation: landscape) and (max-height: 500px) {
  .call-overlay {
    padding: 10px;
  }

  .call-card {
    padding: 20px;
    max-width: 320px;
  }

  .avatar {
    width: 80px;
    height: 80px;
    font-size: 32px;
    margin-bottom: 20px;
  }

  .call-header {
    margin-bottom: 20px;
  }

  .call-body {
    margin-bottom: 24px;
  }

  .call-actions {
    gap: 20px;
  }
}

/* ========== ANIMACIÓN DE LLAMADA ENTRANTE ========== */
@keyframes incomingCall {
  0% {
    transform: scale(0.95);
    opacity: 0;
  }
  50% {
    transform: scale(1.02);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.call-card {
  animation: incomingCall 0.6s ease-out;
}
</style>
