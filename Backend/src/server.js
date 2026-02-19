import { server } from "./app.js";

const PORT = process.env.API_PORT || 5000;
// API_HOST fija el servidor a la interfaz eno1 (192.168.1.100).
// Si no está definido cae a 0.0.0.0 (todas las interfaces).
const HOST = process.env.API_HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
});
