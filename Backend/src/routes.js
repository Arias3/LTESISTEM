import authRoutes from "./modules/auth/auth.routes.js";
import chatRoutes from "./modules/chat/chat.routes.js";
import sensorsRoutes from "./modules/sensors/sensors.routes.js";
import geoRoutes from "./modules/geo/geo.routes.js";
import { requireAuth } from "./middleware/authJWT.js";
import express from "express";

const router = express.Router();

// Rutas públicas
router.use("/auth", authRoutes);

// Rutas protegidas
router.use(requireAuth);
router.use("/chat", chatRoutes);
router.use("/sensors", sensorsRoutes);
router.use("/geo", geoRoutes);

export default router;
