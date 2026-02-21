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

  const PERSIST_DELAY_MS = 30_000; // 30 segundos

  /** Construye el array de usuarios activos para broadcast */
  function buildLocationsPayload() {
    const locations = [];
    for (const [userId, data] of geoUsers.entries()) {
      // Solo incluir usuarios online con ubicación válida (no 0,0)
      if (data.online && (data.latitude !== 0 || data.longitude !== 0)) {
        locations.push({
          id: data.geoId || userId,
          accountId: userId,
          name: data.name,
          username: data.username,
          role: data.role,
          location: {
            latitude: data.latitude,
            longitude: data.longitude,
          },
          online: true,
          timestamp: data.timestamp,
        });
      }
    }
    return locations;
  }

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

      // Enviarle la ubicación actual de todos
      socket.emit("geo:locations-update", buildLocationsPayload());
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

      // Broadcast a todos los clientes conectados
      io.emit("geo:locations-update", buildLocationsPayload());

      // Persistir con debounce
      debouncedPersist(userId, latitude, longitude);
    });

    /* ========= DISCONNECT (complementa call gateway) ========= */
    socket.on("disconnect", () => {
      const userId = socket.geoUserId;
      if (!userId) return;

      const userData = geoUsers.get(userId);
      if (userData) {
        userData.online = false;
        userData.timestamp = Date.now();

        console.log(`📍 Geo: usuario desconectado ${userData.username} (${userId})`);

        // Broadcast actualizado (usuario aparecerá offline)
        io.emit("geo:locations-update", buildLocationsPayload());

        // Persistir inmediatamente el estado offline
        // Limpiar timer de debounce pendiente
        if (persistTimers.has(userId)) {
          clearTimeout(persistTimers.get(userId));
          persistTimers.delete(userId);
        }

        // Marcar offline en DB
        GeoService.setUserOffline(userId).catch((err) => {
          console.error(`❌ Error marcando offline a ${userId}:`, err.message);
        });

        // Persistir última ubicación conocida
        if (userData.latitude !== 0 && userData.longitude !== 0) {
          GeoService.updateUserLocation(userId, userData.latitude, userData.longitude).catch(
            (err) => {
              console.error(`❌ Error persistiendo última ubicación de ${userId}:`, err.message);
            }
          );
        }
      }
    });
  });

  console.log("📍 Geo Gateway inicializado");
}
