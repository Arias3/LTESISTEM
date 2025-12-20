// src/routes.js
import authRoutes from "./modules/auth/auth.routes.js";
// import deviceRoutes from "./modules/devices/devices.routes.js";
import chatRoutes from "./modules/chat/chat.routes.js";
// import sensorsRoutes from "./modules/sensors/sensors.routes.js";
// import cameraRoutes from "./modules/camera/camera.routes.js";
import { requireAuth } from "./middleware/authSession.js";
import express from "express";

const router = express.Router();

// Rutas públicas
router.use("/auth", authRoutes);

// Rutas protegidas
router.use(requireAuth);

//router.use("/devices", deviceRoutes);
router.use("/chat", chatRoutes);
//router.use("/sensors", sensorsRoutes);
//router.use("/camera", cameraRoutes);

export default router;
