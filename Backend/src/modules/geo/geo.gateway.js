// src/modules/geo/geo.gateway.js
import { GeoService } from "./geo.service.js";

/**
 * Gateway Socket.IO para geolocalización en tiempo real.
 * Patrón: relay con persistencia diferida.
 *
 * - Clientes envían su GPS vía `geo:update-location`
 * - El backend mantiene un Map en memoria y hace broadcast
 * - Persiste en PostgreSQL con debounce (cada 30s por usuario)
 */
export default function initGeoGateway(io) {
  // userId → { accountId, name, username, role, latitude, longitude, online, timestamp }
  const geoUsers = new Map();

  // userId → timeoutId  (debounce para persistencia en DB)
  const persistTimers = new Map();
  const userSockets = new Map();

  const PERSIST_DELAY_MS = 30_000; // 30 segundos

  /** Construye y emite snapshot completo de usuarios (online + offline) */
  async function broadcastUsersSnapshot() {
    try {
      const usersFromDb = await GeoService.getUsers(true);

      const payload = usersFromDb.map((dbUser) => {
        const userId = dbUser.accountId;
        const live = geoUsers.get(userId);
        const hasLiveLocation =
          live &&
          live.latitude !== 0 &&
          live.longitude !== 0;

        return {
          ...dbUser,
          location: hasLiveLocation
            ? {
                latitude: live.latitude,
                longitude: live.longitude,
              }
            : dbUser.location,
          online: live ? Boolean(live.online) : Boolean(dbUser.online),
          timestamp: live ? live.timestamp : dbUser.timestamp,
          lastUpdate: live
            ? new Date(live.timestamp).toISOString()
            : dbUser.lastUpdate,
        };
      });

      io.emit("geo:locations-update", payload);
    } catch (error) {
      console.error("❌ Error en broadcastUsersSnapshot:", error.message);
    }
  }

  // Broadcast periódico general para refrescar estados stale y sincronizar a todos (cada 5s)
  setInterval(() => {
    broadcastUsersSnapshot();
  }, 5_000);

  /** Persiste la ubicación en PostgreSQL con debounce */
  function debouncedPersist(userId, latitude, longitude) {
    // Limpiar timer anterior si existe
    if (persistTimers.has(userId)) {
      clearTimeout(persistTimers.get(userId));
    }

    const timer = setTimeout(async () => {
      try {
        await GeoService.updateUserLocation(userId, latitude, longitude);
        persistTimers.delete(userId);
      } catch (error) {
        console.error(`❌ Error persistiendo ubicación de ${userId}:`, error.message);
        persistTimers.delete(userId);
      }
    }, PERSIST_DELAY_MS);

    persistTimers.set(userId, timer);
  }

  io.on("connection", (socket) => {

    /* ========= GEO REGISTER ========= */
    socket.on("geo:register", ({ userId, name, username, role }) => {
      if (!userId) return;

      socket.geoUserId = userId;
      if (!userSockets.has(userId)) userSockets.set(userId, new Set());
      userSockets.get(userId).add(socket.id);

      // Inicializar en el Map (sin ubicación aún)
      if (!geoUsers.has(userId)) {
        geoUsers.set(userId, {
          geoId: null,
          name: name || "Usuario",
          username: username || "",
          role: role || "OPERATOR",
          latitude: 0,
          longitude: 0,
          online: true,
          timestamp: Date.now(),
        });
      } else {
        // Ya existe, solo marcar online
        const existing = geoUsers.get(userId);
        existing.online = true;
        existing.name = name || existing.name;
        existing.username = username || existing.username;
        existing.role = role || existing.role;
        existing.timestamp = Date.now();
      }

      console.log(`📍 Geo: usuario registrado ${username} (${userId})`);

      // Enviarle el snapshot completo y actualizar a todos
      broadcastUsersSnapshot();
    });

    /* ========= GEO UPDATE LOCATION ========= */
    socket.on("geo:update-location", ({ latitude, longitude }) => {
      const userId = socket.geoUserId;
      if (!userId || latitude === undefined || longitude === undefined) return;

      // Validar rangos
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return;
      }

      const userData = geoUsers.get(userId);
      if (!userData) return;

      // Actualizar en memoria
      userData.latitude = latitude;
      userData.longitude = longitude;
      userData.online = true;
      userData.timestamp = Date.now();

      // Broadcast snapshot completo
      broadcastUsersSnapshot();

      // Persistir con debounce
      debouncedPersist(userId, latitude, longitude);
    });

    /* ========= GEO HEARTBEAT ========= */
    socket.on("geo:heartbeat", () => {
      const userId = socket.geoUserId;
      if (!userId) return;

      const userData = geoUsers.get(userId);
      if (userData) {
        userData.online = true;
        userData.timestamp = Date.now();
      }
    });

    /* ========= DISCONNECT (complementa call gateway) ========= */
    socket.on("disconnect", () => {
      const userId = socket.geoUserId;
      if (!userId) return;

      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        }
      }

      // Si el usuario aún tiene otra pestaña/socket conectado, no marcar offline
      if (userSockets.has(userId)) {
        return;
      }

      const userData = geoUsers.get(userId);
      if (userData) {
        userData.online = false;
        userData.timestamp = Date.now();

        console.log(`📍 Geo: usuario desconectado ${userData.username} (${userId})`);

        // Broadcast actualizado (usuario aparecerá offline)
        broadcastUsersSnapshot();

        // Persistir inmediatamente el estado offline
        // Limpiar timer de debounce pendiente
        if (persistTimers.has(userId)) {
          clearTimeout(persistTimers.get(userId));
          persistTimers.delete(userId);
        }

        // Marcar offline en DB
        GeoService.setUserOffline(userId).catch((err) => {
          if (err.code !== 'P2025' && err.code !== 'P2003') {
            console.error(`❌ Error marcando offline a ${userId}:`, err.message);
          }
        });

        // Persistir última ubicación conocida
        if (userData.latitude !== 0 && userData.longitude !== 0) {
          GeoService.updateUserLocation(userId, userData.latitude, userData.longitude).catch(
            (err) => {
              if (err.code !== 'P2025' && err.code !== 'P2003') {
                console.error(`❌ Error persistiendo última ubicación de ${userId}:`, err.message);
              }
            }
          );
        }
      }
    });
  });

  console.log("📍 Geo Gateway inicializado");
}
