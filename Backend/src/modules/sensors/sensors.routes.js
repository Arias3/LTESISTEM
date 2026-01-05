import { Router } from "express";
import { SensorsService } from "./sensors.service.js";

const router = Router();

//////////////////////////////////////////////////
// DEVICES
//////////////////////////////////////////////////

// Registrar dispositivo
router.post("/devices/register", async (req, res) => {
  try {
    const { displayName, ipAddress, firmwareVersion, model, manufacturer } = req.body;

    if (!displayName || !ipAddress) {
      return res.status(400).json({ error: "displayName and ipAddress are required" });
    }

    const device = await SensorsService.registerDevice({
      displayName,
      ipAddress,
      firmwareVersion,
      model,
      manufacturer
    });

    res.json(device);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
});

// Listar dispositivos
router.get("/devices", async (req, res) => {
  try {
    const devices = await SensorsService.getDevices();
    res.json(devices);
  } catch (error) {
    console.error("Error al listar dispositivos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});


// Obtener dispositivo
router.get("/devices/:id", async (req, res) => {
  try {
    const device = await SensorsService.getDeviceById(req.params.id);
    res.json(device);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Renombrar dispositivo
router.post("/devices/:id/name", async (req, res) => {
  try {
    const { displayName } = req.body;
    const device = await SensorsService.setDeviceName(req.params.id, displayName);
    res.json(device);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Cambiar estado (ACTIVE / INACTIVE / ALERT)
router.post("/devices/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const device = await SensorsService.setDeviceStatus(req.params.id, status);
    res.json(device);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Keep Alive
router.post("/devices/:id/keepalive", async (req, res) => {
  try {
    const device = await SensorsService.keepAlive(req.params.id);
    res.json(device);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


//////////////////////////////////////////////////
// POLLING
//////////////////////////////////////////////////

router.post("/devices/:id/poll", async (req, res) => {
  try {
    const reading = await SensorsService.pollDevice(req.params.id);
    res.json(reading);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


//////////////////////////////////////////////////
// DATA READING
//////////////////////////////////////////////////

// Última lectura
router.get("/devices/:id/readings/last", async (req, res) => {
  try {
    const data = await SensorsService.getLastReading(req.params.id);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Historial
router.get("/devices/:id/readings", async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const history = await SensorsService.getHistory(req.params.id, limit);
    res.json(history);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
