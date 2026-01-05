// src/modules/call/call.events.js
export const callEvents = {
  /* ============ REQUEST CALL (Solo notificación) ============ */
  handleCallRequest(io, socket, connectedUsers, payload = {}) {
    const { receiverId, mode } = payload;
    const callerId = socket.userId;
    const callerName = socket.userName;

    if (!callerId || !receiverId || !mode) {
      console.warn("❌ call:request inválido", payload);
      return;
    }

    console.log(`📞 ${callerName} llama a ${receiverId} (${mode})`);

    const receiverSocket = connectedUsers.get(receiverId);

    if (!receiverSocket) {
      io.to(socket.id).emit("call:unavailable", { receiverId });
      return;
    }

    // Solo notificación UI - NO incluir offer aquí
    io.to(receiverSocket).emit("call:incoming", {
      callerId,
      callerName,
      mode,
      timestamp: Date.now(),
    });
  },

  cleanupPendingCalls(pendingCalls, userId) {
    for (const [receiverId, call] of pendingCalls.entries()) {
      if (call.callerId === userId || receiverId === userId) {
        pendingCalls.delete(receiverId);
      }
    }
  },
};