import type { RowDataPacket } from "mysql2";
import { pool } from "../db.js";
import { env } from "../env.js";
import { logger } from "../lib/logger.js";
import { commandDurationSecSql } from "../lib/command-duration.js";
import type { SystemMode, WateringSource } from "../contract.js";
import { logError } from "../services/history.service.js";
import { updateDeviceStatus } from "../services/status.service.js";
import { dispatchNextQueued, wasStopRequested, withWateringLock } from "../services/watering.service.js";
import { broadcastSensors, broadcastStatus } from "../realtime/socket.js";
import { IN } from "./topics.js";

// Nilai sensor datang satu per satu di topik masing-masing. Ditampung di
// sini, lalu ditulis sebagai satu baris secara berkala. Menulis satu baris
// per pesan akan menghasilkan enam baris setengah kosong setiap siklus.
const buffer = {
  soil_moisture: null as number | null,
  soil_temp: null as number | null,
  air_temp: null as number | null,
  air_humidity: null as number | null,
  ph: null as number | null,
  ec: null as number | null,
};
type SensorColumn = keyof typeof buffer;
let bufferDirty = false;
let lastWrite = 0;
let lastMessageAt = 0;
let flushTimer: NodeJS.Timeout | null = null;

// Jeda menunggu rombongan nilai sensor tiba sebelum satu baris ditulis.
const SETTLE_MS = 2000;

/** Rentang wajar tiap sensor. Pesan di luar rentang ditolak, bukan disimpan. */
const RANGE: Record<SensorColumn, [number, number]> = {
  soil_moisture: [0, 100],
  soil_temp: [-40, 85],
  air_temp: [-40, 85],
  air_humidity: [0, 100],
  ph: [0, 14],
  ec: [0, 20],
};

function setSensor(column: SensorColumn, raw: string): void {
  const value = Number(raw);
  const range = RANGE[column];
  if (!Number.isFinite(value) || value < range[0] || value > range[1]) {
    void logError(`Nilai ${column} di luar rentang: ${raw}`, { severity: "warning", source: "mqtt" });
    return;
  }
  buffer[column] = value;
  bufferDirty = true;
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushSensors()
      .then(() => broadcastSensors())
      .catch((err) => logger.error({ err }, "gagal menyimpan pembacaan sensor"));
  }, SETTLE_MS);
}

async function flushSensors(): Promise<void> {
  if (!bufferDirty) return;
  if (lastWrite !== 0 && Date.now() - lastWrite < env.SENSOR_WRITE_MS) return;
  lastWrite = Date.now();
  bufferDirty = false;
  await pool.execute(
    `INSERT INTO sensor_readings
       (soil_moisture, soil_temp, air_temp, air_humidity, ph, ec, received_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
    [buffer.soil_moisture, buffer.soil_temp, buffer.air_temp, buffer.air_humidity, buffer.ph, buffer.ec],
  );
}

async function openWatering(zone: number): Promise<void> {
  const [running] = await pool.execute<RowDataPacket[]>(
    `SELECT id, zone_id FROM watering_events WHERE result = 'berjalan' LIMIT 1`,
  );
  if (running[0] && Number(running[0].zone_id) === zone) return; // sudah tercatat

  if (running[0]) await closeWatering(); // valve pindah tanpa lapor tutup

  // Perintah terkait: yang paling awal mengantre untuk zona ini.
  const [cmds] = await pool.execute<RowDataPacket[]>(
    `SELECT id, queue_id, ${commandDurationSecSql} AS duration_sec, user_id FROM control_commands
      WHERE type = 'start' AND zone_id = ? AND outcome = 'sent'
      ORDER BY created_at, id LIMIT 1`,
    [zone],
  );
  const cmd = cmds[0];
  const source: WateringSource = cmd && cmd.user_id !== null ? "manual" : "auto";
  const plannedSec = cmd ? Number(cmd.duration_sec) : 0;

  await pool.execute(
    `INSERT INTO watering_events
       (zone_id, command_id, source, queue_id, started_at, planned_sec, result)
     VALUES (?, ?, ?, ?, NOW(3), ?, 'berjalan')`,
    [zone, cmd ? cmd.id : null, source, cmd ? cmd.queue_id : null, plannedSec],
  );
  if (cmd) {
    await pool.execute(`UPDATE control_commands SET outcome = 'running' WHERE id = ?`, [cmd.id]);
  }
}

async function closeWatering(): Promise<void> {
  const result = wasStopRequested() ? "dihentikan" : "selesai";
  await pool.execute(
    `UPDATE watering_events
        SET ended_at = NOW(3),
            actual_sec = TIMESTAMPDIFF(SECOND, started_at, NOW(3)),
            result = ?
      WHERE result = 'berjalan'`,
    [result],
  );
  await pool.execute(
    `UPDATE control_commands SET outcome = 'done' WHERE outcome = 'running'`,
  );
}

export async function handleMessage(topic: string, payload: string): Promise<void> {
  lastMessageAt = Date.now();
  const text = payload.trim();

  switch (topic) {
    case IN.soilMoisture: setSensor("soil_moisture", text); break;
    case IN.soilTemp:     setSensor("soil_temp", text); break;
    case IN.airTemp:      setSensor("air_temp", text); break;
    case IN.airHumidity:  setSensor("air_humidity", text); break;
    case IN.ph:           setSensor("ph", text); break;
    case IN.ec:           setSensor("ec", text); break;

    case IN.status: {
      const mode = text.toLowerCase() as SystemMode;
      if (!["auto", "manual", "error"].includes(mode)) return;
      await updateDeviceStatus({ mode, online: true });
      broadcastStatus();
      return;
    }

    case IN.activeValve: {
      const zone = Number(text);
      if (!Number.isInteger(zone) || zone < 0 || zone > 13) return;
      await withWateringLock(async () => {
        if (zone === 0) {
          await closeWatering();
          await dispatchNextQueued();
        } else {
          await openWatering(zone);
        }
      });
      broadcastStatus();
      return;
    }

    case IN.nextSchedule:
      await updateDeviceStatus({ nextSchedule: /^\d{2}:\d{2}$/.test(text) ? text : null, online: true });
      broadcastStatus();
      return;

    case IN.uptime:
      await updateDeviceStatus({ uptimeSec: Number.isFinite(Number(text)) ? Number(text) : null, online: true });
      return;

    case IN.wifiRssi:
      await updateDeviceStatus({ wifiRssi: Number.isFinite(Number(text)) ? Number(text) : null, online: true });
      return;

    case IN.lastError: {
      const msg = text === "" ? null : text;
      await updateDeviceStatus({ lastError: msg, online: true });
      if (msg) await logError(msg, { severity: "error", source: "controller" });
      broadcastStatus();
      return;
    }

    case IN.lwt:
      // Last Will: broker menerbitkannya sendiri saat sambungan putus.
      await updateDeviceStatus({ online: text === "online" });
      broadcastStatus();
      return;

    default:
      return;
  }

  scheduleFlush();
}

/**
 * Status daring tidak pernah dikirim sebagai pesan. Ia disimpulkan: kalau
 * tidak ada pesan apa pun selama beberapa menit, perangkat dianggap putus.
 * Tanpa ini, dashboard akan terus menampilkan "Sistem Online" padahal
 * kabelnya sudah dicabut sejak kemarin.
 */
export function startOfflineWatcher(): NodeJS.Timeout {
  return setInterval(() => {
    void (async () => {
      if (lastMessageAt === 0) return;
      const silent = Date.now() - lastMessageAt > env.OFFLINE_AFTER_MS;
      const [rows] = await pool.execute<RowDataPacket[]>(`SELECT online FROM system_status WHERE id = 1`);
      const wasOnline = Boolean(rows[0]?.online);
      if (silent && wasOnline) {
        await updateDeviceStatus({ online: false });
        await logError("Controller tidak mengirim data, dianggap offline.", { severity: "warning", source: "backend" });
        broadcastStatus();
        logger.warn("controller dianggap offline");
      }
    })().catch((err) => logger.error({ err }, "offline watcher gagal"));
  }, 30_000);
}
