import type { RowDataPacket } from "mysql2";
import { pool } from "../db.js";
import type { ActiveWatering, QueueItem, SystemMode, SystemStatus, WateringSource } from "../contract.js";
import { num, toHhMm, toIso } from "../lib/time.js";

export async function getSystemStatus(): Promise<SystemStatus> {
  const [statusRows] = await pool.execute<RowDataPacket[]>(
    `SELECT online, mode, next_schedule, uptime_sec, wifi_rssi, last_error
       FROM system_status WHERE id = 1`,
  );
  const s = statusRows[0];

  // Paling banyak satu baris, karena interlock hanya mengizinkan satu valve.
  const [activeRows] = await pool.execute<RowDataPacket[]>(
    `SELECT zone_id, started_at, planned_sec, source
       FROM watering_events
      WHERE result = 'berjalan'
      ORDER BY started_at DESC
      LIMIT 1`,
  );
  const a = activeRows[0];
  const active: ActiveWatering | null = a
    ? {
        zone: Number(a.zone_id),
        startedAt: toIso(a.started_at as Date) ?? new Date().toISOString(),
        durationSec: Number(a.planned_sec),
        source: a.source as WateringSource,
      }
    : null;

  // Antrean bukan tabel tersendiri: ia diturunkan dari perintah yang
  // sudah diterima tetapi belum dijalankan perangkat.
  const [queueRows] = await pool.execute<RowDataPacket[]>(
    `SELECT queue_id, zone_id, duration_min, user_id
       FROM control_commands
      WHERE type = 'start' AND outcome = 'queued'
      ORDER BY created_at`,
  );
  const queue: QueueItem[] = queueRows.map((r) => ({
    id: String(r.queue_id),
    zone: Number(r.zone_id),
    durationMin: Number(r.duration_min),
    source: (r.user_id === null ? "auto" : "manual") as WateringSource,
  }));

  return {
    online: Boolean(s?.online),
    mode: (s?.mode ?? "auto") as SystemMode,
    active,
    queue,
    nextSchedule: toHhMm((s?.next_schedule as string | null) ?? null),
    batteryVolt: null, // hapus baris ini bila sudah dihapus dari frontend
    uptimeSec: num(s?.uptime_sec),
    wifiRssi: num(s?.wifi_rssi),
    lastError: (s?.last_error as string | null) ?? null,
  };
}

/** Dipanggil hanya dari jalur MQTT. REST tidak boleh mengubah tabel ini. */
export async function updateDeviceStatus(patch: {
  online?: boolean;
  mode?: SystemMode;
  nextSchedule?: string | null;
  uptimeSec?: number | null;
  wifiRssi?: number | null;
  lastError?: string | null;
}): Promise<void> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  const add = (col: string, val: string | number | null) => {
    sets.push(`${col} = ?`);
    values.push(val);
  };

  if (patch.online !== undefined) add("online", patch.online ? 1 : 0);
  if (patch.mode !== undefined) add("mode", patch.mode);
  if (patch.nextSchedule !== undefined) add("next_schedule", patch.nextSchedule ? `${patch.nextSchedule}:00` : null);
  if (patch.uptimeSec !== undefined) add("uptime_sec", patch.uptimeSec);
  if (patch.wifiRssi !== undefined) add("wifi_rssi", patch.wifiRssi);
  if (patch.lastError !== undefined) add("last_error", patch.lastError);
  if (sets.length === 0) return;

  await pool.execute(`UPDATE system_status SET ${sets.join(", ")} WHERE id = 1`, values);
}
