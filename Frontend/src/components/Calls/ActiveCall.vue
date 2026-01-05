<script setup lang="ts">
import { computed, watch, ref, onMounted, nextTick, onUnmounted } from "vue";
import { useCallStore } from "../../stores/call";
import { useWebRTCStore } from "../../stores/webrtc";

const call = useCallStore();
const webrtc = useWebRTCStore();

const remoteAudio = ref<HTMLAudioElement | null>(null);
const remoteVideo = ref<HTMLVideoElement | null>(null);
const localVideo = ref<HTMLVideoElement | null>(null);

// Verificar el estado real de la llamada - CORREGIDO
const isActiveCall = computed(() => {
  // Mostrar cuando estamos en llamada activa O cuando estamos llamando
  return (
    (call.state === "in-call" || call.state === "calling") &&
    call.activeCall !== null
  );
});

const isVideo = computed(() => call.activeCall?.mode === "video");

const peerLabel = computed(() => {
  if (call.activeCall?.peerName) return call.activeCall.peerName;
  if (call.incomingCall?.callerName) return call.incomingCall.callerName;
  return "Usuario";
});

const statusLabel = computed(() => {
  if (call.state === "calling") return "Llamando…";
  if (call.state === "ringing") return "Llamada entrante…";
  if (call.state === "in-call") {
    if (!webrtc.remoteStream) return "Conectando...";
    if (!webrtc.localStream) return "Configurando micrófono...";
    return "En llamada";
  }
  return "";
});

/* 🎥 ENLAZAR STREAM REMOTO */
watch(
  () => webrtc.remoteStream,
  (stream) => {
    if (!stream) {
      console.log("🔇 Stream remoto no disponible");
      return;
    }

    console.log("🎯 Stream remoto disponible, tracks:", {
      audio: stream.getAudioTracks().length,
      video: stream.getVideoTracks().length,
    });

    // Pequeño delay para asegurar que el DOM esté listo
    nextTick(() => {
      if (isVideo.value && remoteVideo.value) {
        console.log("🎬 Configurando video remoto");
        remoteVideo.value.srcObject = stream;
        remoteVideo.value.muted = false;
        remoteVideo.value.play().catch((error) => {
          console.warn("❌ Error reproduciendo video remoto:", error);
          // Intentar de nuevo
          setTimeout(() => remoteVideo.value?.play().catch(() => {}), 500);
        });
      }

      if (!isVideo.value && remoteAudio.value) {
        console.log("🔊 Configurando audio remoto");
        remoteAudio.value.srcObject = stream;
        remoteAudio.value.muted = false;
        remoteAudio.value.play().catch((error) => {
          console.warn("❌ Error reproduciendo audio remoto:", error);
          // Intentar de nuevo
          setTimeout(() => remoteAudio.value?.play().catch(() => {}), 500);
        });
      }
    });
  },
  { immediate: true }
);

/* 🎥 ENLAZAR STREAM LOCAL */
watch(
  () => webrtc.localStream,
  (stream) => {
    if (!stream) {
      console.log("🎤 Stream local no disponible");
      return;
    }

    console.log("🎥 Stream local disponible, tracks:", {
      audio: stream.getAudioTracks().length,
      video: stream.getVideoTracks().length,
    });

    nextTick(() => {
      if (isVideo.value && localVideo.value) {
        console.log("🎥 Configurando video local");
        localVideo.value.srcObject = stream;
        localVideo.value.muted = true; // Siempre muteado para evitar eco
        localVideo.value.play().catch((error) => {
          console.warn("❌ Error reproduciendo video local:", error);
        });
      }
    });
  },
  { immediate: true }
);

// Verificar estado periódicamente
let connectionCheckInterval: number | null = null;

onMounted(() => {
  console.log("📱 ActiveCall montado", {
    state: call.state,
    activeCall: call.activeCall,
    isVideo: isVideo.value,
    hasLocalStream: !!webrtc.localStream,
    hasRemoteStream: !!webrtc.remoteStream,
    pcState: webrtc.pc?.connectionState,
    pcIceState: webrtc.pc?.iceConnectionState,
  });

  // Verificar estado de conexión cada 2 segundos
  connectionCheckInterval = window.setInterval(() => {
    if (call.state === "in-call" && webrtc.pc) {
      console.log("📊 Estado conexión:", {
        connectionState: webrtc.pc.connectionState,
        iceConnectionState: webrtc.pc.iceConnectionState,
        iceGatheringState: webrtc.pc.iceGatheringState,
        signalingState: webrtc.pc.signalingState,
      });
    }
  }, 2000);
});

onUnmounted(() => {
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
    connectionCheckInterval = null;
  }
});

const hangup = () => {
  console.log("📴 Colgando llamada");
  call.endCall();
};

// Función para cambiar de cámara
// Función mejorada para cambiar de cámara
const switchCamera = async () => {
  if (!webrtc.localStream || !isVideo.value) return;

  try {
    console.log("🔄 Cambiando cámara...");

    // Obtener todos los dispositivos de video
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(
      (device) => device.kind === "videoinput"
    );

    console.log("📷 Dispositivos de video encontrados:", videoDevices.length);

    if (videoDevices.length < 2) {
      console.log("📷 Solo hay una cámara disponible");
      return;
    }

    // Obtener track actual
    const currentVideoTrack = webrtc.localStream.getVideoTracks()[0];
    if (!currentVideoTrack) return;

    // Obtener dispositivo actual si es posible
    const currentSettings = currentVideoTrack.getSettings();
    const currentDeviceId = currentSettings.deviceId;

    console.log("📷 Dispositivo actual:", currentDeviceId);

    // Encontrar el siguiente dispositivo (alternar)
    let nextDeviceId: string;

    if (videoDevices.length === 2) {
      // Para 2 cámaras, simplemente alternar
      nextDeviceId =
        videoDevices.find((device) => device.deviceId !== currentDeviceId)
          ?.deviceId ||
        videoDevices[0]?.deviceId ||
        "";
    } else {
      // Para múltiples cámaras, rotar
      const currentIndex = videoDevices.findIndex(
        (device) => device.deviceId === currentDeviceId
      );
      const nextIndex = (currentIndex + 1) % videoDevices.length;
      const nextDevice = videoDevices[nextIndex];
      nextDeviceId = nextDevice?.deviceId || videoDevices[0]?.deviceId || "";
    }

    console.log("📷 Cambiando a dispositivo:", nextDeviceId);

    // Parar track actual
    currentVideoTrack.stop();

    try {
      // Obtener nuevo stream con el dispositivo específico
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: nextDeviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];

      if (!newVideoTrack) {
        throw new Error("No se pudo obtener el nuevo track de video");
      }

      // Reemplazar track en PeerConnection
      const sender = webrtc.pc
        ?.getSenders()
        .find((s) => s.track?.kind === "video");

      if (sender) {
        // Reemplazar track en la conexión WebRTC
        await sender.replaceTrack(newVideoTrack);
        console.log("✅ Track reemplazado en PeerConnection");
      }

      // Reemplazar track en el stream local
      webrtc.localStream.removeTrack(currentVideoTrack);
      webrtc.localStream.addTrack(newVideoTrack);

      // Actualizar video local
      if (localVideo.value && webrtc.localStream) {
        localVideo.value.srcObject = webrtc.localStream;
      }

      // Detener el audio del nuevo stream (ya tenemos audio del stream original)
      newStream.getAudioTracks().forEach((track) => track.stop());

      console.log("✅ Cámara cambiada exitosamente");
    } catch (deviceError) {
      console.error("❌ Error con dispositivo específico:", deviceError);

      // Fallback: intentar con facingMode
      console.log("🔄 Intentando con facingMode como fallback...");

      const currentFacingMode = currentSettings.facingMode;
      const newFacingMode =
        currentFacingMode === "user" ? "environment" : "user";

      const fallbackStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      const fallbackVideoTrack = fallbackStream.getVideoTracks()[0];
      const sender = webrtc.pc
        ?.getSenders()
        .find((s) => s.track?.kind === "video");

      if (sender && fallbackVideoTrack) {
        await sender.replaceTrack(fallbackVideoTrack);
        webrtc.localStream.removeTrack(currentVideoTrack);
        webrtc.localStream.addTrack(fallbackVideoTrack);

        if (localVideo.value) {
          localVideo.value.srcObject = webrtc.localStream;
        }

        fallbackStream.getAudioTracks().forEach((track) => track.stop());
        console.log("✅ Cámara cambiada usando facingMode");
      }
    }
  } catch (error) {
    console.error("❌ Error cambiando cámara:", error);
  }
};
</script>

<template>
  <div v-if="isActiveCall" class="call-overlay">
    <div class="call-card" :class="{ video: isVideo }">
      <!-- VIDEOCALL -->
      <template v-if="isVideo">
        <div class="video-wrapper">
          <!-- Video remoto -->
          <video
            v-if="webrtc.remoteStream"
            ref="remoteVideo"
            class="remote-video"
            autoplay
            playsinline
          />

          <!-- Video local -->
          <video
            v-if="webrtc.localStream"
            ref="localVideo"
            class="local-video"
            autoplay
            muted
            playsinline
          />

          <!-- Controles -->
          <div class="controls">
            <div class="top-bar">
              <div class="caller-info">
                <p class="caller-name">{{ peerLabel }}</p>
                <p class="call-status">{{ statusLabel }}</p>
              </div>
            </div>

            <div class="bottom-controls">
              <button class="control-btn switch-camera" @click="switchCamera">
                <svg class="icon" viewBox="0 0 24 24">
                  <path
                    d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"
                  />
                </svg>
              </button>

              <button class="control-btn hangup" @click="hangup">
                <svg class="icon" viewBox="0 0 24 24">
                  <path
                    d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- AUDIOCALL -->
      <template v-else>
        <div class="audio-container">
          <div class="caller-avatar">
            <div class="avatar">
              {{ peerLabel.charAt(0).toUpperCase() }}
            </div>
            <p class="caller-name">{{ peerLabel }}</p>
            <p class="call-status">{{ statusLabel }}</p>
          </div>

          <div class="audio-controls">
            <button class="control-btn hangup" @click="hangup">
              <svg class="icon" viewBox="0 0 24 24">
                <path
                  d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
                />
              </svg>
            </button>
          </div>

          <!-- Indicador de audio -->
          <div v-if="call.state === 'in-call'" class="audio-indicator">
            <div class="sound-waves">
              <div class="wave"></div>
              <div class="wave"></div>
              <div class="wave"></div>
            </div>
            <p>Conectado</p>
          </div>

          <!-- ELEMENTO AUDIO OCULTO (¡IMPORTANTE!) -->
          <audio
            v-if="webrtc.remoteStream"
            ref="remoteAudio"
            autoplay
            class="hidden-audio"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ========== BASE ========== */
.call-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: black;
  z-index: 9999;
}

.call-card {
  width: 100%;
  height: 100%;
}

/* ========== VIDEOCALL ========== */
.video-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  background: black;
}

.remote-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: black;
}

.local-video {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 100px;
  height: 150px;
  object-fit: cover;
  border-radius: 10px;
  border: 2px solid white;
  background: black;
  transform: scaleX(-1);
}

/* Controles videollamada */
.controls {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.top-bar {
  padding: 20px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.7), transparent);
}

.caller-info {
  text-align: left;
}

.caller-name {
  margin: 0;
  font-size: 18px;
  color: white;
  font-weight: 600;
}

.call-status {
  margin: 4px 0 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
}

.bottom-controls {
  padding: 20px;
  display: flex;
  justify-content: center;
  gap: 40px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
}

.control-btn {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.control-btn.hangup {
  background: #ff4444;
}

.control-btn.switch-camera {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
}

.icon {
  width: 24px;
  height: 24px;
  fill: white;
}

/* ========== AUDIOCALL ========== */
.audio-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #151b63, #345ba9);
}

.caller-avatar {
  text-align: center;
  margin-bottom: 60px;
}

.avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: white;
  color: #1a237e;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: bold;
  margin: 0 auto 20px;
}

.audio-controls {
  margin-bottom: 40px;
}

.audio-indicator {
  text-align: center;
  color: white;
}

.sound-waves {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-bottom: 10px;
}

.wave {
  width: 4px;
  height: 20px;
  background: white;
  border-radius: 2px;
  animation: wave 1s infinite alternate;
}

.wave:nth-child(2) {
  animation-delay: 0.2s;
}
.wave:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes wave {
  from {
    height: 8px;
  }
  to {
    height: 20px;
  }
}

.audio-indicator p {
  margin: 0;
  font-size: 14px;
  opacity: 0.8;
}

/* ========== RESPONSIVE ========== */
@media (max-width: 480px) {
  .local-video {
    width: 80px;
    height: 120px;
    top: 10px;
    right: 10px;
  }

  .control-btn {
    width: 56px;
    height: 56px;
  }

  .bottom-controls {
    gap: 30px;
  }
}

@media (min-width: 768px) {
  .call-overlay {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.9);
  }

  .call-card {
    max-width: 500px;
    max-height: 700px;
    border-radius: 20px;
    overflow: hidden;
  }
}
</style>
