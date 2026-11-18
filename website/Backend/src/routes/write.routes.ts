import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../auth/guard.js";
import { badRequest } from "../lib/HttpError.js";
import { MAX_WATERING_MIN, MIN_WATERING_MIN, ZONE_COUNT, validManualDuration } from "../contract.js";
import { saveSchedule } from "../services/schedule.service.js";
import { cancelAllQueued, cancelQueued, setMode, startWatering, stopWatering } from "../services/watering.service.js";
import { publishSchedule } from "../mqtt/outbound.js";
import { broadcastStatus } from "../realtime/socket.js";

export const writeRouter = Router();
writeRouter.use(requireAuth, requireAdmin);

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const scheduleSchema = z
  .object({ first: z.string().regex(HHMM), second: z.string().regex(HHMM) })
  // Frontend sudah memeriksa ini, tetapi pemeriksaan di layar bukan pengamanan.
  .refine((s) => s.first !== s.second, { message: "Jadwal pertama dan kedua tidak boleh sama." });

const wateringSchema = z.object({
  durationMin: z.number().min(MIN_WATERING_MIN).max(MAX_WATERING_MIN).refine(validManualDuration),
  zone: z.number().int().min(1).max(ZONE_COUNT).optional(),
}).strict();

const modeSchema = z.object({ mode: z.enum(["auto", "manual"]) });

writeRouter.put("/schedule", async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Jadwal tidak sah.");
  }
  await saveSchedule(req.user!.sub, parsed.data);
  await publishSchedule(parsed.data);
  broadcastStatus();
  res.status(204).end();
});

writeRouter.post("/watering", async (req, res) => {
  const parsed = wateringSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest("Pilih jalur yang valid dan durasi 30 detik sampai 5 menit per jalur.");
  }
  await startWatering(req.user!.sub, parsed.data.durationMin, parsed.data.zone);
  broadcastStatus();
  res.status(204).end();
});

writeRouter.post("/watering/stop", async (req, res) => {
  await stopWatering(req.user!.sub);
  broadcastStatus();
  res.status(204).end();
});

writeRouter.delete("/watering/queue", async (req, res) => {
  await cancelAllQueued(req.user!.sub);
  broadcastStatus();
  res.status(204).end();
});

writeRouter.delete("/watering/queue/:id", async (req, res) => {
  const id = req.params.id;
  if (!id) throw badRequest("Id antrean tidak diberikan.");
  await cancelQueued(req.user!.sub, id);
  broadcastStatus();
  res.status(204).end();
});

writeRouter.put("/mode", async (req, res) => {
  const parsed = modeSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Mode harus 'auto' atau 'manual'.");
  await setMode(req.user!.sub, parsed.data.mode);
  broadcastStatus();
  res.status(204).end();
});
