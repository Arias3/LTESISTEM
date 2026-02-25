// src/modules/geo/device.routes.js
import { Router } from "express";
import { GeoService } from "./geo.service.js";
import { requireAuth } from "../../middleware/authJWT.js";

const router = Router();

/**
 * GET /api/devices
 * Lista todos los dispositivos registrados
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const onlineOnly = req.query.online === "true";
    const devices = await GeoService.getDevices(onlineOnly);
    res.json({ success: true, devices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/devices/discover/:deviceId
 * Busca un dispositivo por su hardware ID
 */
router.get("/discover/:deviceId", async (req, res) => {
  try {
    const device = await GeoService.findByDeviceId(req.params.deviceId);
    if (device) {
      res.json({ success: true, found: true, device });
    } else {
      res.json({ success: true, found: false, device: null });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/devices/:deviceId
 * Actualiza la configuración de un dispositivo
 */
router.put("/:deviceId", requireAuth, async (req, res) => {
  try {
    const device = await GeoService.updateDeviceConfig(
      req.params.deviceId,
      req.body
    );
    res.json({ success: true, device });
  } catch (error) {
    console.error("Error actualizando dispositivo", req.params.deviceId, error);
    res.status(500).json({
      success: false,
      error: error.message || "Error actualizando dispositivo",
    });
  }
});

export default router;
