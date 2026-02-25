import { defineStore } from "pinia";

export type CallMode = "audio" | "video";

export const useWebRTCStore = defineStore("webrtc", {
  state: () => ({
    pc: null as RTCPeerConnection | null,
    localStream: null as MediaStream | null,
    remoteStream: null as MediaStream | null,

    // callback que el call store registrará
    onIceCandidate: null as ((candidate: RTCIceCandidate) => void) | null,

    // Buffer para ICE candidates que llegan antes de que remoteDescription esté listo
    pendingIceCandidates: [] as RTCIceCandidateInit[],
  }),

  actions: {
    async init(mode: CallMode) {
      this.close();

      console.log("🎤 Solicitando permisos para:", mode);

      try {
        // Configuración de medios
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
        // No crear stream vacío aquí: se asigna en ontrack cuando ya tiene tracks,
        // para que Vue reactive dispare el watcher con el stream completo.

        pc.ontrack = (event) => {
          console.log("📥 Track remoto recibido:", event.track.kind);

          // Siempre crear un nuevo MediaStream para forzar que Vue re-dispare el
          // watcher en cada track (audio Y video). Si se reutiliza la misma
          // referencia, Vue no detecta el cambio y el <video> no hace play().
          if (event.streams && event.streams[0]) {
            this.remoteStream = new MediaStream(event.streams[0].getTracks());
          } else {
            const prevTracks = this.remoteStream?.getTracks() ?? [];
            this.remoteStream = new MediaStream([...prevTracks, event.track]);
          }
          console.log("📥 remoteStream actualizado, tracks:", this.remoteStream.getTracks().length);
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
        const err = error as Error;
        console.error("❌ Error obteniendo medios:", err.name, err.message);

        // ── Permiso denegado o contexto no seguro (sin HTTPS / CA no instalada)
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          const msg =
            "❌ Permiso de cámara/micrófono denegado.\n\n" +
            "Causas posibles:\n" +
            "• El certificado SSL no está instalado en este dispositivo.\n" +
            "• El navegador bloqueó el permiso manualmente.\n\n" +
            "Solución: instala el archivo ltesistem-ca.crt como CA de confianza " +
            "y recarga la página.";
          alert(msg);
          throw err; // propaga para que call.ts haga rejectCall / resetCall
        }

        // ── Contexto no seguro (acceso desde HTTP en vez de HTTPS)
        if (err.name === "SecurityError") {
          alert(
            "❌ El navegador bloqueó el acceso a cámara/micrófono porque " +
            "la conexión no es segura (HTTP).\n\n" +
            `Accede al sistema usando HTTPS: https://${import.meta.env.VITE_HOST}:4000`
          );
          throw err;
        }

        // ── Dispositivo no encontrado → intentar configuración mínima
        if (
          err.name === "NotFoundError" ||
          err.name === "DevicesNotFoundError"
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
          throw err;
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
      this.pendingIceCandidates = [];
    },
  },
});
