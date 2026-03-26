// src/modules/geo/device.gateway.js
import { GeoService } from "./geo.service.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret";

/**
 * Gateway Socket.IO para dispositivos ESP32.
 *
 * Eventos entrantes:
 *  - device:register      → ESP32 se registra (requiere JWT válido)
 *  - device:sensor-update → ESP32 envía sensorData
 *  - disconnect           → Marca device offline, broadcast
 *
 * Broadcast:
 *  - device:data-update   → TODOS los devices (online + offline) con lastSeen
 */
export default function initDeviceGateway(io) {
  // deviceId → deviceData in-memory
  const connectedDevices = new Map();
  const lastSensorState = new Map(); // Tracker de último sensorData enviado

  // Timers de debounce para persist
  const persistTimers = new Map();
  const PERSIST_DELAY_MS = 10_000;
  const HEARTBEAT_TIMEOUT_MS = 30_000;
  const HEARTBEAT_CHECK_INTERVAL_MS = 5_000;

  const parseNumberOrNull = (v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // ──────────────────────────────────────────────
  // BROADCAST: envía TODOS los devices (online+offline)
  // ──────────────────────────────────────────────
  const broadcastDevices = async () => {
    try {
      // Traer TODOS desde la DB (online e históricos)
      const allDevices = await GeoService.getDevices(false);

      const payload = allDevices.map((dbDev) => {
        // Determinar online = si está en el mapa connectedDevices (tiene conexión socket activa)
        const isOnline = connectedDevices.has(dbDev.deviceId);
        return {
          id: dbDev.id,
          deviceId: dbDev.deviceId,
          name: dbDev.name,
          type: dbDev.type,
          icon: dbDev.type === "sensor" ? "📡" : "🔧",
          location: dbDev.location || {
            latitude: Number(dbDev.latitude),
            longitude: Number(dbDev.longitude),
          },
          online: isOnline,
          status: isOnline ? "online" : "offline",
          sensorData: dbDev.sensorData || {},
          sensorConfig: dbDev.sensorConfig || {},
          samplingInterval: dbDev.samplingInterval,
          lastUpdate: dbDev.lastUpdate,
          timestamp: new Date(dbDev.lastUpdate).getTime(),
        };
      });

      io.emit("device:data-update", payload);
    } catch (err) {
      console.error("❌ Error en broadcastDevices:", err.message);
    }
  };

  // Debounce persist sensor data
  const debouncedPersistSensor = (deviceId, sensorData) => {
    if (persistTimers.has(deviceId)) clearTimeout(persistTimers.get(deviceId));
    const t = setTimeout(async () => {
      try {
        await GeoService.updateDeviceSensorData(deviceId, sensorData);
      } catch (e) {
        console.error(`❌ Persist sensor ${deviceId}:`, e.message);
      }
      persistTimers.delete(deviceId);
    }, PERSIST_DELAY_MS);
    persistTimers.set(deviceId, t);
  };

  // Verificar JWT del handshake
  const verifySocketToken = (socket) => {
    const token =
      socket.handshake.query?.token ||
      socket.handshake.auth?.token;
    if (!token) return null;
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch {
      return null;
    }
  };

  // ──────────────────────────────────────────────
  // SOCKET EVENTS
  // ──────────────────────────────────────────────
  io.on("connection", (socket) => {

    /* DEVICE:REGISTER */
    socket.on(
      "device:register",
      async ({ deviceId, name, type, networkType, latitude, longitude,
               hasGps, sensorConfig, samplingInterval }) => {
        if (!deviceId) return;

        const authUser = verifySocketToken(socket);
        if (!authUser) {
          console.warn(`⛔ device:register sin JWT válido: ${deviceId}`);
          socket.emit("device:config-response", {
            success: false,
            error: "No autenticado. Usa POST /api/auth/device-register",
          });
          socket.disconnect(true);
          return;
        }
        const tokenDeviceId = authUser.deviceId || authUser.username;
        if (tokenDeviceId !== deviceId) {
          console.warn(`⛔ JWT no corresponde a deviceId ${deviceId}`);
          socket.emit("device:config-response", {
            success: false,
            error: "Token no corresponde a este dispositivo",
          });
          socket.disconnect(true);
          return;
        }

        socket.deviceId = deviceId;
        socket.authUser = authUser;
        console.log(`📡 Device: registrando ${deviceId} (usuario: ${authUser.username})`);

        try {
          const oldLive = connectedDevices.get(deviceId);
          if (oldLive?.socketId && oldLive.socketId !== socket.id) {
            const oldSocket = io.sockets.sockets.get(oldLive.socketId);
            if (oldSocket) {
              oldSocket.disconnect(true);
            }
          }

          const device = await GeoService.registerDevice({
            deviceId, name, type, networkType,
            latitude, longitude, hasGps, sensorConfig, samplingInterval,
          });

          const now = Date.now();
          connectedDevices.set(deviceId, {
            ...device,
            socketId: socket.id,
            online: true,
            sensorData: device.sensorData || {},
            samplingInterval: samplingInterval || device.samplingInterval || 5,
            lastHeartbeat: now,
          });

          console.log(`✅ Device registrado: ${device.name} (${deviceId})`);

          // Respuesta de config al ESP32
          socket.emit("device:config-response", {
            success: true,
            config: device,
          });

          // Broadcast a frontends (incluye todos los devices)
          broadcastDevices();
        } catch (err) {
          console.error(`❌ Error registrando ${deviceId}:`, err.message);
          socket.emit("device:config-response", {
            success: false,
            error: err.message,
          });
        }
      }
    );

    /* DEVICE:SENSOR-UPDATE */
    socket.on("device:sensor-update", ({ sensorData }) => {
      const deviceId = socket.deviceId;
      if (!deviceId || !sensorData) return;

      console.log(`[SENSOR UPDATE] Device ${deviceId} sent data:`, JSON.stringify(sensorData));

      const live = connectedDevices.get(deviceId);
      if (!live) return;
      if (live.socketId !== socket.id) return;

      const lastState = lastSensorState.get(deviceId);
      const stateChanged = !lastState || JSON.stringify(lastState) !== JSON.stringify(sensorData);
      if (!stateChanged) return;

      lastSensorState.set(deviceId, sensorData);
      live.sensorData = sensorData;

      // Broadcast solo si hay cambio de datos
      broadcastDevices();
      debouncedPersistSensor(deviceId, sensorData);
    });

    /* DEVICE:HEARTBEAT */
    socket.on("device:heartbeat", ({ latitude, longitude } = {}) => {
      const deviceId = socket.deviceId;
      if (!deviceId) return;

      const live = connectedDevices.get(deviceId);
      if (!live) return;
      if (live.socketId !== socket.id) return;

      live.lastHeartbeat = Date.now();

      const lat = parseNumberOrNull(latitude);
      const lng = parseNumberOrNull(longitude);

      if (lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        live.location = { latitude: lat, longitude: lng };
      }

      GeoService.touchDeviceAlive(deviceId, {
        latitude: lat,
        longitude: lng,
      }).catch(err => {
        console.error(`❌ Heartbeat DB ${deviceId}:`, err.message);
      });

      // Heartbeat NO hace broadcast automático
    });

    /* DISCONNECT */
    socket.on("disconnect", () => {
      const deviceId = socket.deviceId;
      if (!deviceId) return;

      const live = connectedDevices.get(deviceId);
      if (live) {
        if (live.socketId !== socket.id) return;

        console.log(`📡 Device desconectado: ${live.name || deviceId} (${deviceId})`);

        // Limpiar timer
        if (persistTimers.has(deviceId)) {
          clearTimeout(persistTimers.get(deviceId));
          persistTimers.delete(deviceId);
        }

        lastSensorState.delete(deviceId);
        connectedDevices.delete(deviceId);

        // Persistir último estado
        GeoService.setDeviceOffline(deviceId).catch(console.error);
        if (live.sensorData && Object.keys(live.sensorData).length > 0) {
          GeoService.updateDeviceSensorData(deviceId, live.sensorData).catch(console.error);
        }

        broadcastDevices();
      }
    });
  });

  setInterval(async () => {
    const now = Date.now();
    let hasChanges = false;

    for (const [deviceId, live] of connectedDevices.entries()) {
      if (!live.online) continue;

      const timeoutMs = Math.max(
        HEARTBEAT_TIMEOUT_MS,
        (Number(live.samplingInterval) || 5) * 3000
      );

      if (now - live.lastHeartbeat > timeoutMs) {
        live.online = false;
        hasChanges = true;
        connectedDevices.delete(deviceId);
        lastSensorState.delete(deviceId);

        try {
          await GeoService.setDeviceOffline(deviceId);
        } catch (err) {
          console.error(`❌ Timeout offline ${deviceId}:`, err.message);
        }
      }
    }

    if (hasChanges) {
      broadcastDevices();
    }
  }, HEARTBEAT_CHECK_INTERVAL_MS);

  console.log("📡 Device Gateway inicializado (JWT + broadcast all devices)");
}
