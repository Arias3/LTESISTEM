import { Router } from "express";
import * as AuthService from "./auth.service.js";

const router = Router();

// Obtener todos los usuarios
router.get("/", async (req, res) => {
  try {
    const users = await AuthService.getUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener usuario por ID
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

router.post("/login", async (req, res) => {
  try {
    const user = await AuthService.loginBasic(req.body);

    req.session.user = user;

    res.json({
      msg: "Login exitoso",
      user
    });

  } catch (err) {
    console.error("Error en login:", err.message);   // Log claro para backend
    res.status(401).json({
      error: err.message
    });
  }
});

router.post("/logout", (req, res) => {
  if (!req.session) {
    return res.status(400).json({ msg: "No hay sesión activa" });
  }

  req.session.destroy(() => {
    res.json({ msg: "Sesión cerrada correctamente" });
  });
});



export default router;
