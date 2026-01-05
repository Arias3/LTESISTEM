import { defineStore } from "pinia";

export type CallMode = "audio" | "video";

export const useWebRTCStore = defineStore("webrtc", {
  state: () => ({
    pc: null as RTCPeerConnection | null,
    localStream: null as MediaStream | null,
    remoteStream: null as MediaStream | null,

    // callback que el call store registrará
    onIceCandidate: null as ((candidate: RTCIceCandidate) => void) | null,
  }),

  actions: {
    async init(mode: CallMode) {
      this.close();

      console.log("🎤 Solicitando permisos para:", mode);

      try {
        // Intentar con configuración más permisiva
        const constraints: MediaStreamConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video:
            mode === "video"
              ? {
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                  facingMode: "user",
                }
              : false,
        };

        this.localStream = await navigator.mediaDevices.getUserMedia(
          constraints
        );

        console.log("✅ Stream local obtenido:", {
          audioTracks: this.localStream.getAudioTracks().length,
          videoTracks: this.localStream.getVideoTracks().length,
          trackLabels: this.localStream.getTracks().map((t) => t.label),
        });

        // Verificar que los tracks están activos
        this.localStream.getAudioTracks().forEach((track) => {
          console.log("🎤 Track de audio:", track.enabled, track.readyState);
        });

        this.localStream.getVideoTracks().forEach((track) => {
          console.log("🎥 Track de video:", track.enabled, track.readyState);
        });

        /* 🌐 PEER CONNECTION */
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun3.l.google.com:19302" },
            { urls: "stun:stun4.l.google.com:19302" },
          ],
          iceCandidatePoolSize: 10,
        });

        /* ➕ LOCAL TRACKS */
        this.localStream.getTracks().forEach((track) => {
          pc.addTrack(track, this.localStream!);
          console.log("➕ Track añadido a PeerConnection:", track.kind);
        });

        /* 📥 REMOTE STREAM */
        this.remoteStream = new MediaStream();

        pc.ontrack = (event) => {
          console.log("📥 Track remoto recibido:", event.track.kind);
          event.streams[0]?.getTracks().forEach((track) => {
            console.log("➕ Añadiendo track remoto:", track.kind, track.id);
            this.remoteStream?.addTrack(track);
          });
        };

        /* ❄ ICE - CON LOGS DETALLADOS */
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log("❄ ICE candidate generado:", event.candidate.type);
            if (this.onIceCandidate) {
              this.onIceCandidate(event.candidate);
            }
          } else {
            console.log("✅ Todos los ICE candidates generados");
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log("🔄 Estado ICE cambiado:", pc.iceConnectionState);
        };

        pc.onconnectionstatechange = () => {
          console.log("🔄 Estado conexión cambiado:", pc.connectionState);
        };

        this.pc = pc;

        console.log("✅ PeerConnection configurada correctamente");
      } catch (error) {
        console.error("❌ Error obteniendo medios:", error);

        // Intentar con configuración más simple si falla
        if (
          (error as Error).name === "NotFoundError" ||
          (error as Error).name === "DevicesNotFoundError"
        ) {
          console.log("🔄 Intentando con configuración mínima...");
          try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: mode === "video" ? true : false,
            });
          } catch (fallbackError) {
            console.error(
              "❌ Error también con configuración mínima:",
              fallbackError
            );
            throw fallbackError;
          }
        } else {
          throw error;
        }
      }
    },

    setIceCandidateHandler(handler: (c: RTCIceCandidate) => void) {
      this.onIceCandidate = handler;
    },

    close() {
      this.pc?.close();
      this.pc = null;

      this.localStream?.getTracks().forEach((t) => t.stop());
      this.localStream = null;
      this.remoteStream = null;
      this.onIceCandidate = null;
    },
  },
});
