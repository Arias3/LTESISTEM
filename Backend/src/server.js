import { server } from "./app.js";

const PORT = process.env.API_PORT || 5000;

server.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});
