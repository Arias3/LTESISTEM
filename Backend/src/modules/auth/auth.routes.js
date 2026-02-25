import { Router } from "express";
import * as AuthService from "./auth.service.js";
import { requireAuth } from "../../middleware/authJWT.js";
import jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "default-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
const DEVICE_PASSWORD = process.env.DEVICE_PASSWORD || "ltesistem-device-2025";

/* ======================
   RUTAS ESPECÍFICAS
====================== */

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const result = await AuthService.loginBasic(req.body);
    res.json({ msg: "Login exitoso", user: result.user, token: result.token });
  } catch (err) {
    console.error("Error en login:", err.message);
    res.status(401).json({ error: err.message });
  }
});

// ME
router.get("/me", requireAuth, (req, res) => {
  console.log("req.user:", req.user);
  console.log("typeof req.user:", typeof req.user);

  if (!req.user) {
    return res.status(401).json({ error: "Usuario no válido" });
  }

  res.json(req.user);
});

// LOGOUT
router.post("/logout", (req, res) => {
  // For JWT, logout is handled client-side by removing token
  res.json({ msg: "Logout exitoso" });
});

// REFRESH TOKEN (optional, for token renewal)
router.post("/refresh", (req, res) => {
  // This would require refresh tokens, for now just return success
  // In a full implementation, verify refresh token and issue new access token
  res.json({ msg: "Token refresh not implemented yet" });
});

// DEVICE REGISTER (auto-registro para ESP32)
// Intenta login; si el usuario no existe, lo crea con role "device"
router.post("/device-register", async (req, res) => {
  try {
    const { deviceId, password } = req.body;
    if (!deviceId || !password) {
      return res.status(400).json({ error: "deviceId y password son requeridos" });
    }

    if (password !== DEVICE_PASSWORD) {
      return res.status(401).json({ error: "Credencial de dispositivo inválida" });
    }

    const ipAddress =
      req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "0.0.0.0";

    const device = await AuthService.registerOrUpdateDeviceRecord({
      deviceId,
      ipAddress,
    });

    const token = jwt.sign(
      {
        id: `device:${device.id}`,
        name: device.displayName,
        username: deviceId,
        deviceId,
        role: "DEVICE",
        kind: "device",
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log(`📡 Device auto-registrado: ${deviceId}`);
    return res.status(200).json({
      msg: "Dispositivo autenticado",
      device: {
        id: device.id,
        deviceId,
        displayName: device.displayName,
        ipAddress: device.ipAddress,
      },
      token,
    });
  } catch (err) {
    console.error("Error en device-register:", err.message);
    res.status(400).json({ error: err.message });
  }
});

/* ======================
   CRUD
====================== */

// Obtener todos los usuarios
router.get("/", async (req, res) => {
  try {
    const users = await AuthService.getUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener usuario por ID (⚠️ SIEMPRE AL FINAL)
router.get("/:id", async (req, res) => {
  try {
    const user = await AuthService.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear usuario
router.post("/", async (req, res) => {
  try {
    const user = await AuthService.createUser(req.body);
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Actualizar usuario
router.put("/:id", async (req, res) => {
  try {
    const user = await AuthService.updateUser(req.params.id, req.body);
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Eliminar usuario
router.delete("/:id", async (req, res) => {
  try {
    await AuthService.deleteUser(req.params.id);
    res.json({ msg: "Usuario eliminado" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
