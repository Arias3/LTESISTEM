import express from "express";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import routes from "./routes.js";

/* ================= ENV ================= */
dotenv.config();

/* ================= APP ================= */
const app = express();

/* ================= CORS ================= */
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true
}));

/* ================= BODY PARSER ================= */
app.use(express.json());

/* ================= ROUTES ================= */
app.use("/api", routes);

/* ================= ROOT ================= */
app.get("/", (req, res) => {
  res.send("Backend API funcionando 🚀");
});

/* ================= HTTP SERVER ================= */
const server = http.createServer(app);

/* ================= SOCKET.IO ================= */
const frontendOrigins = process.env.FRONTEND_ORIGINS
  ? process.env.FRONTEND_ORIGINS.split(',').map(origin => origin.trim())
  : ["http://192.168.1.100:4000", "http://10.45.0.1:4000"];

const io = new Server(server, {
  cors: {
    origin: frontendOrigins,
    credentials: true
  }
});

/* ================= CALL GATEWAY ================= */
import initCallGateway from "./modules/call/call.gateway.js";
initCallGateway(io);

export { app, server };
