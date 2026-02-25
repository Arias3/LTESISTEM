import { server } from "./app.js";

const PORT = process.env.API_PORT || 5000;
const HOST = process.env.API_HOST || "0.0.0.0";

// Detecta el protocolo real que usó app.js
const proto = server instanceof (await import("https")).Server ? "https" : "http";

server.listen(PORT, HOST, () => {
  console.log(`Servidor corriendo en ${proto}://${HOST}:${PORT}`);
});
