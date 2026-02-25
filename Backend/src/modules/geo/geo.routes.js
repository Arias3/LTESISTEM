import { Router } from "express";
import { GeoService } from "./geo.service.js";

const router = Router();

//////////////////////////////////////////////////
// USERS GEO
//////////////////////////////////////////////////

/**
 * GET /api/geo/users
 * Obtiene todos los usuarios con ubicación activa
 */
router.get("/users", async (req, res) => {
  try {
    const users = await GeoService.getUsers();
    res.json(users);
  } catch (error) {
    console.error("Error al obtener usuarios geo:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/geo/reverse-geocode?lat=..&lng=..
 * Proxy server-side para geocodificación inversa (evita CORS en frontend)
 */
router.get("/reverse-geocode", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({ error: "Latitud inválida" });
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ error: "Longitud inválida" });
    }

    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "json");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("zoom", "18");
    url.searchParams.set("addressdetails", "1");

    const upstream = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "Accept-Language": "es",
        "User-Agent": "LTESISTEM/1.0 (geo reverse proxy)",
      },
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(502).json({
        error: "Error de geocodificación externa",
        details: text?.slice(0, 200) || `HTTP ${upstream.status}`,
      });
    }

    const data = await upstream.json();
    res.json(data);
  } catch (error) {
    console.error("Error en reverse-geocode:", error);
    res.status(500).json({ error: "Error en reverse-geocode" });
  }
});

/**
 * POST /api/geo/users/location
 * Actualiza la ubicación de un usuario
 * Body: { accountId, latitude, longitude }
 */
router.post("/users/location", async (req, res) => {
  try {
    const { accountId, latitude, longitude } = req.body;

    if (!accountId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ 
        error: "accountId, latitude y longitude son requeridos" 
      });
    }

    // Validar rangos
    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({ 
        error: "Latitud debe estar entre -90 y 90" 
      });
    }

    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({ 
        error: "Longitud debe estar entre -180 y 180" 
      });
    }

    const user = await GeoService.updateUserLocation(accountId, latitude, longitude);
    res.json(user);
  } catch (error) {
    console.error("Error al actualizar ubicación de usuario:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/geo/users/:accountId/offline
 * Marca un usuario como offline
 */
router.post("/users/:accountId/offline", async (req, res) => {
  try {
    await GeoService.setUserOffline(req.params.accountId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error al marcar usuario offline:", error);
    res.status(500).json({ error: error.message });
  }
});

//////////////////////////////////////////////////
// DEVICES GEO
//////////////////////////////////////////////////

/**
 * GET /api/geo/devices
 * Obtiene todos los dispositivos/sensores activos
 */
router.get("/devices", async (req, res) => {
  try {
    const devices = await GeoService.getDevices();
    res.json(devices);
  } catch (error) {
    console.error("Error al obtener dispositivos geo:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/geo/devices
 * Crea o actualiza un dispositivo geo
 * Body: { id?, name, type, latitude, longitude, sensorData? }
 */
router.post("/devices", async (req, res) => {
  try {
    const { id, name, type, latitude, longitude, sensorData } = req.body;

    if (!name || !type || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ 
        error: "name, type, latitude y longitude son requeridos" 
      });
    }

    // Validar rangos
    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({ 
        error: "Latitud debe estar entre -90 y 90" 
      });
    }

    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({ 
        error: "Longitud debe estar entre -180 y 180" 
      });
    }

    const device = await GeoService.upsertDevice({
      id,
      name,
      type,
      latitude,
      longitude,
      sensorData: sensorData || {},
    });

    res.json(device);
  } catch (error) {
    console.error("Error al crear/actualizar dispositivo:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/geo/devices/:id/sensor-data
 * Actualiza los datos de sensores de un dispositivo
 * Body: { sensorData }
 */
router.put("/devices/:id/sensor-data", async (req, res) => {
  try {
    const { sensorData } = req.body;

    if (!sensorData) {
      return res.status(400).json({ error: "sensorData es requerido" });
    }

    await GeoService.updateDeviceSensorData(req.params.id, sensorData);
    res.json({ success: true });
  } catch (error) {
    console.error("Error al actualizar datos de sensor:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/geo/devices/:id/offline
 * Marca un dispositivo como offline
 */
router.post("/devices/:id/offline", async (req, res) => {
  try {
    await GeoService.setDeviceOffline(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error al marcar dispositivo offline:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
