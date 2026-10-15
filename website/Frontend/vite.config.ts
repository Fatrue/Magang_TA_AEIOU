import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Versi bersih: tanpa plugin khusus Figma Make, tanpa Tailwind (tidak terpakai, lihat 6.4).
// Port 5173. Permintaan /api dan /socket.io diteruskan ke backend di port 3000 (dipakai saat VITE_API_MODE=http).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/socket.io": { target: "http://localhost:3000", ws: true },
    },
  },
});