import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const backendUrl = process.env.VITE_BACKEND_URL ?? "http://127.0.0.1:3001";

// Versi bersih: tanpa plugin khusus Figma Make, tanpa Tailwind (tidak terpakai, lihat 6.4).
// Permintaan /api dan /socket.io diteruskan ke backendUrl saat VITE_API_MODE=http.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    port: 5173,
    proxy: {
      "/api": backendUrl,
      "/socket.io": { target: backendUrl, ws: true },
    },
  },
});
