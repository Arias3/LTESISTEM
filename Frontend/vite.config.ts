import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";
import path from "path";

const certsDir = path.resolve(__dirname, "..", "certs");
const certFile = path.join(certsDir, "cert.pem");
const keyFile = path.join(certsDir, "key.pem");
const useSSL = fs.existsSync(certFile) && fs.existsSync(keyFile);

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 4000,
    ...(useSSL && {
      https: {
        cert: fs.readFileSync(certFile),
        key: fs.readFileSync(keyFile),
      },
    }),
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
});
