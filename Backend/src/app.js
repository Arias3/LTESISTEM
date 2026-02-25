import express from "express";
import dotenv from "dotenv";
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import cors from "cors";
import routes from "./routes.js";

/* ================= ENV ================= */
dotenv.config();

/* ================= APP ================= */
const app = express();

/* ================= CORS ================= */
app.use(cors({
  origin: true,
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

/* ================= HTTPS / HTTP SERVER ================= */
// Rutas a los archivos SSL (relativas a la raíz del proyecto)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SSL_CERT = path.resolve(
  __dirname, "..", "..",
  process.env.SSL_CERT_PATH || "ssl/ltesistem.crt"
);
const SSL_KEY = path.resolve(
  __dirname, "..", "..",
  process.env.SSL_KEY_PATH || "ssl/ltesistem.key"
);

let server;

if (fs.existsSync(SSL_CERT) && fs.existsSync(SSL_KEY)) {
  // ── HTTPS ── certificados encontrados
  const sslOptions = {
    cert: fs.readFileSync(SSL_CERT),
    key: fs.readFileSync(SSL_KEY),
  };
  server = https.createServer(sslOptions, app);
  console.log("🔐  Modo HTTPS activado");
} else {
  // ── HTTP ── fallback mientras no existan los certificados
  server = http.createServer(app);
  console.warn(
    "⚠️   Certificados SSL no encontrados → corriendo en HTTP.\n" +
    "    Ejecuta generate-ssl.sh y reinicia el servidor."
  );
}

/* ================= SOCKET.IO ================= */
const frontendOrigins = process.env.FRONTEND_ORIGINS
  ? process.env.FRONTEND_ORIGINS.split(',').map(origin => origin.trim())
  : [`https://${process.env.API_HOST}:4000`, "http://localhost:4000"];

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
