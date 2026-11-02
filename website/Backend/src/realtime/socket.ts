import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../env.js";
import { logger } from "../lib/logger.js";
import { verifyToken } from "../auth/token.js";
import { getSystemStatus } from "../services/status.service.js";
import { getLatestSensors } from "../services/sensors.service.js";

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
    transports: ["websocket"], // frontend tidak memakai polling
  });

  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: string } | undefined)?.token;
    if (!token) return next(new Error("unauthorized"));
    try {
      socket.data.user = verifyToken(token);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    logger.debug({ id: socket.id }, "socket terhubung");
  });

  return io;
}

/**
 * Siaran dibatasi satu kali per detik. Hitungan waktu sisa pada kartu
 * penyiraman aktif dihitung sendiri di browser, jadi siaran yang lebih
 * rapat hanya membebani tanpa membuat tampilan lebih mulus.
 */
function throttle(fn: () => Promise<void>, ms: number): () => void {
  let last = 0;
  let timer: NodeJS.Timeout | null = null;
  const run = () => {
    last = Date.now();
    timer = null;
    void fn().catch((err) => logger.error({ err }, "gagal menyiarkan"));
  };
  return () => {
    if (timer) return;
    const wait = Math.max(0, ms - (Date.now() - last));
    timer = setTimeout(run, wait);
  };
}

export const broadcastStatus = throttle(async () => {
  io?.emit("status", await getSystemStatus());
}, 1000);

export const broadcastSensors = throttle(async () => {
  io?.emit("sensors", await getLatestSensors());
}, 1000);
