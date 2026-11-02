import { createServer } from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./env.js";
import { logger } from "./lib/logger.js";
import { HttpError } from "./lib/HttpError.js";
import { pingDb } from "./db.js";
import { authRouter } from "./routes/auth.routes.js";
import { readRouter } from "./routes/read.routes.js";
import { writeRouter } from "./routes/write.routes.js";
import { initSocket } from "./realtime/socket.js";
import { connectMqtt } from "./mqtt/client.js";
import { handleMessage, startOfflineWatcher } from "./mqtt/inbound.js";
import { SUBSCRIPTIONS } from "./mqtt/topics.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "32kb" })); // body besar tidak pernah dibutuhkan di sini

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api", readRouter);
app.use("/api", writeRouter);

// Dashboard hasil build frontend. Di laptop folder ini biasanya tidak ada,
// karena frontend dijalankan sendiri oleh Vite di port 5173. Di server,
// isinya hasil `npm run build` frontend — satu alamat untuk keduanya,
// sehingga tidak ada urusan CORS sama sekali.
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
if (existsSync(publicDir)) {
  app.use(express.static(publicDir));
  // React Router memakai rute dalam seperti /lainnya/jadwal yang tidak punya
  // berkas sendiri. Semua GET non-API dikembalikan ke index.html, dan router
  // di browser yang menentukan halaman mana yang tampil.
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

app.use((_req, res) => {
  res.status(404).json({ message: "Alamat tidak dikenal." });
});

// Express 5 meneruskan error dari fungsi async ke sini secara otomatis,
// jadi route tidak perlu dibungkus try/catch satu per satu.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500) logger.error({ err }, "kesalahan tidak tertangani");
  // Di produksi, rincian kesalahan 500 tidak dibocorkan ke pengguna: isinya
  // bisa memuat nama tabel atau jalur berkas. Saat pengembangan justru
  // sebaliknya — menyembunyikannya hanya memaksa pembacaan log bolak-balik.
  const detail = err instanceof Error ? err.message : "Permintaan gagal.";
  const message =
    status >= 500
      ? env.NODE_ENV === "development"
        ? `[dev] ${detail}`
        : "Terjadi kesalahan di server. Coba lagi beberapa saat lagi."
      : detail;
  res.status(status).json({ message });
});

async function main(): Promise<void> {
  await pingDb();
  logger.info("basis data terhubung");

  const httpServer = createServer(app);
  initSocket(httpServer);

  connectMqtt((topic, payload) => void handleMessage(topic, payload), SUBSCRIPTIONS);
  const watcher = startOfflineWatcher();

  httpServer.listen(env.PORT, () => {
    logger.info(`backend siap di http://localhost:${env.PORT}`);
  });

  const shutdown = () => {
    clearInterval(watcher);
    httpServer.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error({ err }, "gagal menjalankan server");
  process.exit(1);
});
