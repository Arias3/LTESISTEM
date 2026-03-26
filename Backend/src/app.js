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
import initCallGateway from "./modules/call/call.gateway.js";

/* ================= ENV ================= */
dotenv.config();

/* ================= APP ================= */
const app = express();

/* ================= SSL ================= */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certsDir = path.join(__dirname, "..", "..", "certs");
const certFile = path.join(certsDir, "cert.pem");
const keyFile = path.join(certsDir, "key.pem");
const useSSL = fs.existsSync(certFile) && fs.existsSync(keyFile);

let sslOptions = {};
if (useSSL) {
  sslOptions = {
    cert: fs.readFileSync(certFile),
    key: fs.readFileSync(keyFile),
  };
  console.log("SSL activado - usando HTTPS");
} else {
  console.log("SSL no encontrado - usando HTTP");
}

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

/* ================= CA CERTIFICATE DOWNLOAD ================= */
// Descarga directa del certificado CA para instalación en dispositivos
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CA_CERT = path.resolve(__dirname, "..", "..", "ssl", "ltesistem-ca.crt");

app.get("/ca", (req, res) => {
  if (!fs.existsSync(CA_CERT)) {
    return res.status(404).send("Certificado CA no encontrado");
  }
  res.setHeader("Content-Type", "application/x-x509-ca-cert");
  res.setHeader("Content-Disposition", "attachment; filename=ltesistem-ca.crt");
  res.sendFile(CA_CERT);
});

// Página con instrucciones de instalación
app.get("/install-cert", (req, res) => {
  const host = req.headers.host || `${process.env.API_HOST}:${process.env.API_PORT}`;
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Instalar Certificado - LTESISTEM</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',system-ui,sans-serif; background:#0f172a; color:#e2e8f0; padding:24px; min-height:100vh; }
    .card { max-width:520px; margin:0 auto; background:#1e293b; border-radius:16px; padding:32px; box-shadow:0 8px 32px rgba(0,0,0,.3); }
    h1 { font-size:1.5rem; margin-bottom:8px; color:#38bdf8; }
    p.sub { color:#94a3b8; margin-bottom:24px; font-size:.9rem; }
    .btn { display:block; width:100%; padding:14px; background:linear-gradient(135deg,#1a73e8,#0d47a1); color:#fff; border:none; border-radius:10px; font-size:1rem; font-weight:600; cursor:pointer; text-align:center; text-decoration:none; margin-bottom:24px; }
    .btn:hover { opacity:.9; }
    h2 { font-size:1.1rem; color:#38bdf8; margin:20px 0 12px; }
    ol { padding-left:20px; line-height:1.8; color:#cbd5e1; font-size:.9rem; }
    .note { background:#1e3a5f; border-left:3px solid #38bdf8; padding:12px; border-radius:6px; font-size:.85rem; color:#93c5fd; margin-top:20px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🔐 LTESISTEM</h1>
    <p class="sub">Instala el certificado de seguridad para acceder al sistema sin advertencias.</p>
    <a class="btn" href="https://${host}/ca">📥 Descargar Certificado</a>
    <h2>📱 Android</h2>
    <ol>
      <li>Toca el botón de arriba para descargar</li>
      <li>Abre <b>Ajustes → Seguridad → Cifrado y credenciales</b></li>
      <li>Toca <b>Instalar certificado → Certificado CA</b></li>
      <li>Selecciona el archivo <b>ltesistem-ca.crt</b> descargado</li>
      <li>Confirma la instalación</li>
    </ol>
    <h2>🍎 iOS / iPadOS</h2>
    <ol>
      <li>Toca el botón de arriba para descargar</li>
      <li>Acepta "Instalar perfil" cuando aparezca</li>
      <li>Ve a <b>Ajustes → General → Gestión de perfiles</b> e instala el perfil</li>
      <li>Ve a <b>Ajustes → General → Información → Certificados de confianza</b></li>
      <li>Activa la confianza para <b>LTESISTEM Root CA</b></li>
    </ol>
    <div class="note">
      💡 Solo necesitas hacer esto <b>una vez</b> por dispositivo. Después, el sistema será seguro automáticamente.
    </div>
  </div>
</body>
</html>`);
});

/* ================= HTTPS / HTTP SERVER ================= */
// Rutas a los archivos SSL (relativas a la raíz del proyecto)
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
    // Acepta frontends conocidos + ESP32 (sin Origin header)
    origin: (origin, callback) => {
      if (!origin || frontendOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Permisivo para dispositivos IoT
      }
    },
    credentials: true
  }
});

/* ================= CALL GATEWAY ================= */
initCallGateway(io);

/* ================= GEO GATEWAY ================= */
import initGeoGateway from "./modules/geo/geo.gateway.js";
initGeoGateway(io);

/* ================= DEVICE GATEWAY (ESP32) ================= */
import initDeviceGateway from "./modules/geo/device.gateway.js";
initDeviceGateway(io);

/* ================= DEVICE REST ROUTES ================= */
import deviceRoutes from "./modules/geo/device.routes.js";
app.use("/api/devices", deviceRoutes);

export { app, server };
