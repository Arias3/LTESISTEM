import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";
import path from "path";

// ── Certificados SSL ─────────────────────────────────────────
// Los archivos los genera generate-ssl.sh en la raíz del proyecto.
const ROOT = path.resolve(__dirname, "..");
const SSL_CERT = path.join(ROOT, "ssl", "ltesistem.crt");
const SSL_KEY = path.join(ROOT, "ssl", "ltesistem.key");

const httpsConfig =
  fs.existsSync(SSL_CERT) && fs.existsSync(SSL_KEY)
    ? { cert: fs.readFileSync(SSL_CERT), key: fs.readFileSync(SSL_KEY) }
    : undefined; // fallback HTTP si aún no se generaron los certs

if (httpsConfig) {
  console.log("🔐  Vite: HTTPS activado con certificado SSL local");
} else {
  console.warn("⚠️   Vite: certificados no encontrados → corriendo en HTTP");
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const HOST = env.VITE_HOST || "0.0.0.0";

  return {
  server: {
    host: HOST,
    port: 4000,
    https: httpsConfig,
    hmr: {
      protocol: "wss",
      host: "ltesistem.local",
    },
  },

  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt", "apple-touch-icon.png"],
      manifest: {
        name: "LTESISTEM",
        short_name: "LTESISTEM",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#317EFB",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  };
});
