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

/* ================= SERVER (HTTPS o HTTP) ================= */
const server = useSSL
  ? https.createServer(sslOptions, app)
  : http.createServer(app);

/* ================= SOCKET.IO ================= */
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

/* ================= CALL GATEWAY ================= */
initCallGateway(io);

export { app, server };
