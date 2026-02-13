import { Router } from "express";
import * as AuthService from "./auth.service.js";
import { requireAuth } from "../../middleware/authJWT.js";

const router = Router();

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
