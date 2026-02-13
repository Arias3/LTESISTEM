import { defineStore } from "pinia";
import { io, Socket } from "socket.io-client";
import { useWebRTCStore } from "./webrtc";

/* ================= TYPES ================= */

export type CallMode = "audio" | "video";

export type CallState = "idle" | "calling" | "ringing" | "in-call";

export interface IncomingCall {
  callerId: string;
  callerName: string;
  mode: CallMode;
  offer?: RTCSessionDescriptionInit; // Hacer opcional ya que llegará por separado
}

/* ================= STORE ================= */

export const useCallStore = defineStore("call", {
  state: () => ({
    socket: null as Socket | null,
    state: "idle" as CallState,
    incomingCall: null as IncomingCall | null,
    activeCall: null as {
      peerId: string;
      peerName: string;
      mode: CallMode;
    } | null,
    callTimeout: null as ReturnType<typeof setTimeout> | null,
    isProcessingCall: false,
    isCaller: false,
    waitingForOffer: false,
    // Buffer para ICE candidates que llegan antes de tener PeerConnection
    pendingIceCandidates: [] as RTCIceCandidateInit[],
  }),

  getters: {
    isCalling: (state) => state.state === "calling",
    isRinging: (state) => state.state === "ringing",
    isInCall: (state) => state.state === "in-call",
  },

  actions: {
    /* ================= SOCKET INIT ================= */

    initSocket(userId: string, userName: string) {
      if (this.socket) {
        console.log('🔄 Socket ya inicializado');
        return;
      }

      console.log('🔌 Inicializando socket de llamadas para:', userName);

      this.socket = io(import.meta.env.VITE_SOCKET_URL, {
        withCredentials: true,
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      this.socket.on("connect", () => {
        console.log("✅ Socket de llamadas conectado:", this.socket?.id);
        this.socket?.emit("register", {
          userId,
          userName,
        });
        console.log("📝 Usuario registrado en socket:", userName);

        // Si teníamos una llamada en progreso, intentar recuperarla
        if (this.state !== "idle" && this.activeCall) {
          console.log("🔄 Reconectando durante llamada, estado:", this.state);
          // Aquí podrías reenviar algún evento para resincronizar
        }
      });

      // AÑADIR: Manejo de desconexión
      this.socket.on("disconnect", (reason) => {
        console.log("🔌 Socket desconectado:", reason);

        // Si estábamos en una llamada, notificar al usuario
        if (this.state !== "idle") {
          console.warn("⚠️ Desconectado durante llamada");

          // Si fue un error de conexión, intentar recuperar
          if (reason === "transport close" || reason === "ping timeout") {
            console.log("🔄 Intentando reconexión...");
          }
        }
      });

      // AÑADIR: Manejo de error de conexión
      this.socket.on("connect_error", (error) => {
        console.error("❌ Error de conexión socket:", error.message);

        // Si estamos en medio de una llamada, notificar
        if (this.state !== "idle") {
          console.error("❌ Conexión perdida durante llamada");
          // Podrías mostrar un mensaje al usuario
        }
      });

      this.registerSocketEvents();
    },

    registerSocketEvents() {
      if (!this.socket) return;

      /* 📞 LLAMADA ENTRANTE - SOLO NOTIFICACIÓN UI */
      this.socket.on("call:incoming", (payload) => {
        console.log("📞 Llamada entrante de", payload);

        this.incomingCall = {
          callerId: payload.callerId || payload.fromUserId,
          callerName: payload.callerName || payload.fromUserName,
          mode: payload.mode,
        };

        this.state = "ringing";
      });

      /* 📡 OFFER → receptor (LLEGA DESPUÉS DE call:incoming) */
      this.socket.on(
        "call:offer",
        async ({ offer, fromUserId, fromUserName }) => {
          console.log(
            "📡 Offer recibido de:",
            fromUserName,
            "estado actual:",
            this.state
          );

          // 🔥 SOLO procesar si estamos en estado 'in-call' (después de aceptar)
          if (
            this.state !== "in-call" ||
            !this.activeCall ||
            this.activeCall.peerId !== fromUserId
          ) {
            console.warn("⚠️ Offer recibido en estado incorrecto:", this.state);

            // Si estamos en 'ringing' y recibimos offer, significa que el backend lo envió demasiado pronto
            if (this.state === "ringing") {
              console.log("⚠️ Offer llegó antes de aceptar, ignorando...");
              // Podrías guardarlo temporalmente o simplemente ignorar
              // El caller deberá reenviarlo después
            }
            return;
          }

          if (this.isProcessingCall) {
            console.warn("⚠️ Ya se está procesando una llamada");
            return;
          }

          this.isProcessingCall = true;
          console.log("🎯 Procesando offer después de aceptar llamada");

          try {
            const webrtc = useWebRTCStore();

            // Si ya tenemos una conexión, reusarla
            if (!webrtc.pc) {
              await webrtc.init(this.activeCall.mode);
            }

            // Configurar manejador ICE
            webrtc.setIceCandidateHandler((candidate) => {
              console.log("❄ Enviando ICE candidate al caller");
              this.socket?.emit("call:ice-candidate", {
                toUserId: fromUserId,
                candidate,
              });
            });

            const pc = webrtc.pc!;

            console.log("📥 Configurando remote description:", offer.type);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));

            console.log("📤 Creando answer");
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            console.log("📤 Enviando answer al caller");
            this.socket?.emit("call:answer", {
              toUserId: fromUserId,
              answer: pc.localDescription,
            });

            // Aplicar ICE candidates bufferizados
            if (this.pendingIceCandidates.length > 0) {
              console.log("❄ Aplicando", this.pendingIceCandidates.length, "ICE candidates bufferizados");
              for (const c of this.pendingIceCandidates) {
                pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
              }
              this.pendingIceCandidates = [];
            }

            console.log("🎉 Conexión WebRTC establecida como receptor");
          } catch (error) {
            console.error("❌ Error procesando offer:", error);
            this.endCall();
          } finally {
            this.isProcessingCall = false;
          }
        }
      ),
        this.socket.on(
          "call:receiver-ready",
          ({ receiverId, receiverName }) => {
            console.log("🎯 Receptor listo:", receiverName);

            // Solo si somos el caller y estamos en estado 'calling'
            if (
              this.state === "calling" &&
              this.activeCall?.peerId === receiverId
            ) {
              console.log("📤 Enviando offer ahora que el receptor está listo");

              // Enviar el offer que ya creamos antes
              const webrtc = useWebRTCStore();
              if (!webrtc.pc || !webrtc.pc.localDescription) {
                console.error("❌ No hay offer creado");
                return;
              }

              this.socket?.emit("call:offer", {
                toUserId: receiverId,
                offer: webrtc.pc.localDescription,
              });
            }
          }
        ),
        /* 📡 ANSWER → emisor */
        this.socket.on("call:answer", async ({ answer, fromUserId }) => {
          console.log(
            "✅ Answer recibido de:",
            fromUserId,
            "estado actual:",
            this.state
          );

          // Solo procesar si somos el caller y estamos en estado 'calling'
          if (
            this.state !== "calling" ||
            !this.activeCall ||
            this.activeCall.peerId !== fromUserId
          ) {
            console.warn("⚠️ Answer recibido en estado incorrecto");
            return;
          }

          const webrtc = useWebRTCStore();
          if (!webrtc.pc) {
            console.error("❌ PeerConnection no inicializado");
            return;
          }

          try {
            console.log("📥 Configurando remote description con answer");
            await webrtc.pc.setRemoteDescription(
              new RTCSessionDescription(answer)
            );

            // Aplicar ICE candidates bufferizados
            if (this.pendingIceCandidates.length > 0) {
              console.log("❄ Aplicando", this.pendingIceCandidates.length, "ICE candidates bufferizados");
              for (const c of this.pendingIceCandidates) {
                webrtc.pc!.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
              }
              this.pendingIceCandidates = [];
            }

            // 🔥 IMPORTANTE: Cambiar estado SOLO después de establecer conexión
            this.state = "in-call";
            this.isCaller = true;

            // Limpiar timeout
            if (this.callTimeout) {
              clearTimeout(this.callTimeout);
              this.callTimeout = null;
            }

            console.log("🎉 Conexión establecida como caller");
          } catch (error) {
            console.error("❌ Error procesando answer:", error);
            this.endCall();
          }
        }),
        /* ✅ ACEPTACIÓN UI */
        this.socket.on("call:accepted", ({ fromUserId, fromUserName }) => {
          console.log("✅ Llamada aceptada por:", fromUserName);

          // Si somos el caller y estamos en estado 'calling'
          if (
            this.state === "calling" &&
            this.activeCall?.peerId === fromUserId
          ) {
            console.log("⏳ Esperando answer del receptor...");
            // No cambiar estado aún, esperar el answer
            // Solo podemos mostrar "Llamada aceptada, conectando..."
          }

          // Si somos el receptor y acabamos de aceptar
          if (
            this.state === "ringing" &&
            this.incomingCall?.callerId === fromUserId
          ) {
            console.log("✅ Caller confirma que aceptamos, esperando offer...");
            // El offer debería llegar pronto
          }
        }),
        /* ❌ RECHAZO */
        this.socket.on("call:rejected", () => {
          console.log("❌ Llamada rechazada");
          this.resetCall();
        });

      /* 📴 FIN */
      this.socket.on("call:ended", () => {
        console.log("📴 Llamada finalizada");
        this.resetCall();
      });

      /* 🚫 NO DISPONIBLE */
      this.socket.on("call:unavailable", () => {
        console.log("🚫 Usuario no disponible");
        this.resetCall();
      });

      /* ❄ ICE CANDIDATE */
      this.socket.on("call:ice-candidate", ({ candidate }) => {
        if (!candidate) return;

        const webrtc = useWebRTCStore();

        // Si no hay PeerConnection aún, guardar para después
        if (!webrtc.pc || !webrtc.pc.remoteDescription) {
          console.log("❄ ICE candidate bufferizado (PC no listo)");
          this.pendingIceCandidates.push(candidate);
          return;
        }

        webrtc.pc
          .addIceCandidate(new RTCIceCandidate(candidate))
          .catch((error) =>
            console.warn("⚠️ Error añadiendo ICE candidate:", error)
          );
      });
    },

    /* ================= CALL FLOW ================= */

    /* 👉 LLAMADA SALIENTE */
    async startCall(receiver: { id: string; name: string }, mode: CallMode) {
      if (!this.socket) {
        console.error("❌ Socket no inicializado");
        alert("Error: No hay conexión con el servidor. Recarga la página.");
        return;
      }
      
      if (this.state !== "idle") {
        console.warn("⚠️ No se puede iniciar llamada:", this.state);
        return;
      }

      console.log("📞 Iniciando llamada a:", receiver.name);
      this.state = "calling";
      this.isCaller = true;

      this.activeCall = {
        peerId: receiver.id,
        peerName: receiver.name,
        mode,
      };

      const webrtc = useWebRTCStore();
      
      try {
        await webrtc.init(mode);
      } catch (error) {
        console.error("❌ Error inicializando WebRTC:", error);
        alert("Error al acceder al micrófono/cámara. Verifica los permisos.");
        this.resetCall();
        return;
      }

      // Configurar manejador ICE
      webrtc.setIceCandidateHandler((candidate) => {
        console.log("❄ Enviando ICE candidate a:", receiver.id);
        this.socket?.emit("call:ice-candidate", {
          toUserId: receiver.id,
          candidate,
        });
      });

      // 1. Solicitar llamada (solo notificación UI)
      this.socket.emit("call:request", {
        receiverId: receiver.id,
        mode,
      });

      // 2. Crear offer PERO NO ENVIARLO TODAVÍA
      try {
        const pc = webrtc.pc!;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        console.log("📝 Offer creado (esperando receptor listo)");

        // Configurar timeout para cancelar si no hay respuesta
        this.callTimeout = setTimeout(() => {
          if (this.state === "calling") {
            console.log("⏰ Timeout - No hay respuesta");
            this.endCall();
          }
        }, 45000); // 45 segundos timeout
      } catch (error) {
        console.error("❌ Error creando offer:", error);
        this.endCall();
      }
    },

    /* 👉 ACEPTAR LLAMADA */
    async acceptCall() {
      if (!this.incomingCall) {
        console.warn("⚠️ No hay llamada entrante para aceptar");
        return;
      }

      if (!this.socket || !this.socket.connected) {
        console.error("❌ Socket no conectado");
        // Mostrar error al usuario
        alert("Error de conexión. Verifica tu conexión a internet.");
        this.resetCall();
        return;
      }

      console.log("✅ Aceptando llamada de:", this.incomingCall.callerName);

      // 1. Primero, obtener permisos de micrófono (y cámara si es video)
      try {
        const webrtc = useWebRTCStore();
        await webrtc.init(this.incomingCall.mode);
        console.log("🎤 Permisos obtenidos correctamente");
      } catch (error) {
        console.error("❌ Error obteniendo permisos:", error);
        alert("No se pudieron obtener los permisos del micrófono/cámara.");
        this.rejectCall();
        return;
      }

      // 2. Establecer activeCall
      this.activeCall = {
        peerId: this.incomingCall.callerId,
        peerName: this.incomingCall.callerName,
        mode: this.incomingCall.mode,
      };

      // 3. Enviar eventos de aceptación - CON RETRY
      try {
        console.log("📤 Enviando accept al caller...");
        this.socket.emit("call:accept", {
          toUserId: this.incomingCall.callerId,
        });

        console.log("📤 Enviando ready-for-offer...");
        this.socket.emit("call:ready-for-offer", {
          toUserId: this.incomingCall.callerId,
        });

        // 4. Cambiar estado
        this.state = "in-call";
        this.incomingCall = null;
        this.isCaller = false;

        console.log("⏳ Esperando offer del caller...");

        // 5. Configurar timeout para recibir offer
        setTimeout(() => {
          if (this.state === "in-call" && !this.isCaller) {
            const webrtc = useWebRTCStore();
            if (
              !webrtc.remoteStream &&
              webrtc.pc?.iceConnectionState !== "connected"
            ) {
              console.warn("⚠️ No se recibió offer en 10 segundos");
              // Podrías preguntar al usuario si quiere esperar más o colgar
            }
          }
        }, 10000); // 10 segundos timeout
      } catch (error) {
        console.error("❌ Error enviando eventos de aceptación:", error);
        this.resetCall();
      }
    },

    /* 👉 RECHAZAR LLAMADA */
    rejectCall() {
      if (!this.incomingCall) return;

      // Usar call:reject en lugar de call:hangup para mayor claridad
      this.socket?.emit("call:reject", {
        toUserId: this.incomingCall.callerId,
      });

      this.resetCall();
    },

    /* 👉 COLGAR */
    endCall() {
      if (this.activeCall && this.socket) {
        this.socket.emit("call:hangup", {
          toUserId: this.activeCall.peerId,
        });
      }

      this.resetCall();
    },

    /* ================= HELPERS ================= */

    resetCall() {
      const webrtc = useWebRTCStore();
      webrtc.close();

      if (this.callTimeout) {
        clearTimeout(this.callTimeout);
        this.callTimeout = null;
      }

      this.state = "idle";
      this.incomingCall = null;
      this.activeCall = null;
      this.isProcessingCall = false;
      this.isCaller = false;
      this.waitingForOffer = false;
      this.pendingIceCandidates = [];
    },

    disconnect() {
      this.socket?.disconnect();
      this.socket = null;
      this.resetCall();
    },
  },
});
