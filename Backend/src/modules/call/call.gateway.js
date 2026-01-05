// src/modules/call/call.gateway.js
import { callEvents } from "./call.events.js";

export default function initCallGateway(io) {
  const connectedUsers = new Map(); // userId -> socketId
  const pendingCalls = new Map(); // receiverId -> {callerId, callerName, mode, callerSocketId, timestamp}

  io.on("connection", (socket) => {
    console.log("🟢 Nuevo cliente conectado", socket.id);

    /* ========= REGISTER USER ========= */
    socket.on("register", ({ userId, userName }) => {
      if (!userId) return;

      socket.userId = userId;
      socket.userName = userName?.trim() || "Usuario";
      
      connectedUsers.set(userId, socket.id);
      console.log(`📝 Usuario registrado: ${userId} (${socket.userName})`);
    });

    /* ========= INICIAR LLAMADA ========= */
    socket.on("call:request", (data) => {
      console.log("📞 Solicitud de llamada:", data);
      
      const { receiverId, mode } = data;
      
      if (!socket.userId || !receiverId || !mode) {
        console.warn("⚠️ Datos inválidos en call:request");
        return;
      }

      const toSocket = connectedUsers.get(receiverId);
      
      if (!toSocket) {
        console.log(`🚫 Receptor ${receiverId} no encontrado`);
        socket.emit("call:unavailable", { receiverId });
        return;
      }

      // Guardar la llamada pendiente
      pendingCalls.set(receiverId, {
        callerId: socket.userId,
        callerName: socket.userName,
        mode,
        callerSocketId: socket.id,
        timestamp: Date.now()
      });

      console.log(`📞 ${socket.userName} llama a ${receiverId} (${mode})`);
      console.log(`📋 Llamadas pendientes:`, Array.from(pendingCalls.entries()));

      // Solo notificación UI
      io.to(toSocket).emit("call:incoming", {
        callerId: socket.userId,
        callerName: socket.userName,
        mode,
        timestamp: Date.now(),
      });
    });

    /* ========= ACEPTAR LLAMADA ========= */
    socket.on("call:accept", ({ toUserId }) => {
      console.log(`✅ ${socket.userName} aceptó llamada de ${toUserId}`);
      
      if (!toUserId) {
        console.warn("⚠️ toUserId no proporcionado en call:accept");
        return;
      }

      const toSocket = connectedUsers.get(toUserId);
      if (!toSocket) {
        console.warn(`⚠️ Caller ${toUserId} no encontrado`);
        // Limpiar llamada pendiente si existe
        pendingCalls.delete(socket.userId);
        return;
      }

      // Notificar al caller que aceptamos
      io.to(toSocket).emit("call:accepted", {
        fromUserId: socket.userId,
        fromUserName: socket.userName,
      });
    });

    /* ========= RECEPTOR LISTO PARA RECIBIR OFFER ========= */
    socket.on("call:ready-for-offer", ({ toUserId }) => {
      console.log(`🎯 ${socket.userName} listo para recibir offer de ${toUserId}`);
      
      const pendingCall = pendingCalls.get(socket.userId);
      if (!pendingCall || pendingCall.callerId !== toUserId) {
        console.warn(`⚠️ No hay llamada pendiente de ${toUserId} para ${socket.userId}`);
        console.log(`📋 Llamadas pendientes actuales:`, Array.from(pendingCalls.entries()));
        return;
      }
      
      const callerSocket = connectedUsers.get(toUserId);
      if (!callerSocket) {
        console.warn(`⚠️ Caller ${toUserId} no encontrado`);
        pendingCalls.delete(socket.userId);
        return;
      }
      
      // Notificar al caller que puede enviar el offer
      io.to(callerSocket).emit("call:receiver-ready", {
        receiverId: socket.userId,
        receiverName: socket.userName,
      });
      
      // Limpiar la llamada pendiente
      pendingCalls.delete(socket.userId);
      console.log(`✅ ${socket.userName} listo, notificando a ${toUserId}`);
    });

    /* ========= OFFER ========= */
    socket.on("call:offer", ({ toUserId, offer }) => {
      console.log(`📤 Offer de ${socket.userName} para ${toUserId}`);
      
      if (!toUserId || !offer) {
        console.warn("⚠️ Datos inválidos en call:offer");
        return;
      }

      const toSocket = connectedUsers.get(toUserId);
      if (!toSocket) {
        console.warn(`⚠️ Receptor ${toUserId} no encontrado`);
        socket.emit("call:unavailable", { receiverId: toUserId });
        return;
      }

      console.log(`📤 Enviando offer a ${toUserId}`);
      io.to(toSocket).emit("call:offer", {
        offer,
        fromUserId: socket.userId,
        fromUserName: socket.userName,
      });
    });

    /* ========= ANSWER ========= */
    socket.on("call:answer", ({ toUserId, answer }) => {
      console.log(`✅ Answer de ${socket.userName} para ${toUserId}`);
      
      if (!toUserId || !answer) {
        console.warn("⚠️ Datos inválidos en call:answer");
        return;
      }

      const toSocket = connectedUsers.get(toUserId);
      if (!toSocket) {
        console.warn(`⚠️ Caller ${toUserId} no encontrado`);
        return;
      }

      console.log(`✅ Enviando answer a ${toUserId}`);
      io.to(toSocket).emit("call:answer", {
        answer,
        fromUserId: socket.userId,
      });
    });

    /* ========= ICE CANDIDATE ========= */
    socket.on("call:ice-candidate", ({ toUserId, candidate }) => {
      console.log(`❄ ICE candidate de ${socket.userId} para ${toUserId}`);
      
      if (!toUserId || !candidate) {
        console.warn("⚠️ Datos inválidos en call:ice-candidate");
        return;
      }

      const toSocket = connectedUsers.get(toUserId);
      if (!toSocket) {
        console.warn(`⚠️ Destino ${toUserId} no encontrado`);
        return;
      }

      io.to(toSocket).emit("call:ice-candidate", { 
        candidate,
        fromUserId: socket.userId,
      });
    });

    /* ========= HANGUP ========= */
    socket.on("call:hangup", ({ toUserId }) => {
      console.log(`📴 Hangup de ${socket.userName} para ${toUserId}`);
      
      const toSocket = connectedUsers.get(toUserId);
      if (!toSocket) {
        console.warn(`⚠️ Destino ${toUserId} no encontrado`);
        return;
      }

      io.to(toSocket).emit("call:ended", {
        fromUserId: socket.userId,
      });
      
      // Limpiar llamadas pendientes relacionadas
      pendingCalls.delete(toUserId);
      pendingCalls.delete(socket.userId);
    });

    /* ========= RECHAZAR LLAMADA ========= */
    socket.on("call:reject", ({ toUserId }) => {
      console.log(`❌ ${socket.userName} rechazó llamada de ${toUserId}`);
      
      const toSocket = connectedUsers.get(toUserId);
      if (!toSocket) {
        console.warn(`⚠️ Caller ${toUserId} no encontrado`);
        return;
      }

      io.to(toSocket).emit("call:rejected", {
        fromUserId: socket.userId,
      });
      
      // Limpiar llamada pendiente
      pendingCalls.delete(socket.userId);
    });

    /* ========= DISCONNECT ========= */
    socket.on("disconnect", () => {
      console.log("🔴 Cliente desconectado", socket.id, socket.userName);
      
      if (socket.userId) {
        connectedUsers.delete(socket.userId);
        
        // Limpiar todas las llamadas pendientes de este usuario
        for (const [receiverId, call] of pendingCalls.entries()) {
          if (call.callerId === socket.userId || receiverId === socket.userId) {
            console.log(`🧹 Limpiando llamada pendiente de ${socket.userId}`);
            pendingCalls.delete(receiverId);
            
            // Notificar al otro usuario si está conectado
            const otherUserId = call.callerId === socket.userId ? receiverId : call.callerId;
            const otherSocket = connectedUsers.get(otherUserId);
            if (otherSocket) {
              io.to(otherSocket).emit("call:ended", {
                fromUserId: socket.userId,
                reason: "disconnect"
              });
            }
          }
        }
        
        // Notificar a todos los usuarios conectados
        io.emit("user:disconnected", {
          userId: socket.userId,
          userName: socket.userName,
        });
      }
    });
  });
}