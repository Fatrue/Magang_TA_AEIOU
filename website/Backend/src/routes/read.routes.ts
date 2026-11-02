import { Router } from "express";
import { requireAuth } from "../auth/guard.js";
import { getSystemStatus } from "../services/status.service.js";
import { getLatestSensors, getSensorSeries } from "../services/sensors.service.js";
import { getErrors, getHistory } from "../services/history.service.js";
import { getSchedule } from "../services/schedule.service.js";

export const readRouter = Router();
readRouter.use(requireAuth);

const intParam = (raw: unknown, fallback: number) => {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

readRouter.get("/status", async (_req, res) => {
  res.json(await getSystemStatus());
});

readRouter.get("/sensors/latest", async (_req, res) => {
  res.json(await getLatestSensors());
});

readRouter.get("/sensors/series", async (req, res) => {
  res.json(await getSensorSeries(intParam(req.query.hours, 24)));
});

readRouter.get("/history", async (req, res) => {
  res.json(await getHistory(intParam(req.query.limit, 20)));
});

readRouter.get("/errors", async (req, res) => {
  res.json(await getErrors(intParam(req.query.limit, 50)));
});

readRouter.get("/schedule", async (_req, res) => {
  res.json(await getSchedule());
});
