import type { RowDataPacket } from "mysql2";
import { pool } from "../db.js";
import type { ErrorLogEntry, HistoryEntry, WateringSource } from "../contract.js";
import { toIso } from "../lib/time.js";

export async function getHistory(limit: number): Promise<HistoryEntry[]> {
  const safe = Math.min(500, Math.max(1, Math.round(limit)));
  const [rows] = await pool.execute<RowDataPacket[]>(
    // `safe` sudah dibulatkan dan dijepit ke 1..500, jadi menyisipkannya
    // langsung tidak membuka celah injeksi. LIMIT memang tidak dapat
    // memakai placeholder `?` secara andal di prepared statement MySQL.
    `SELECT id, zone_id, started_at, planned_sec, actual_sec, result, source
       FROM watering_events
      WHERE result <> 'berjalan'
      ORDER BY started_at DESC
      LIMIT ${safe}`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    zone: Number(r.zone_id),
    startedAt: toIso(r.started_at as Date) ?? new Date(0).toISOString(),
    durationMin: Number(r.actual_sec ?? r.planned_sec) / 60,
    result: r.result as HistoryEntry["result"],
    source: r.source as WateringSource,
  }));
}

export async function getErrors(limit: number): Promise<ErrorLogEntry[]> {
  const safe = Math.min(500, Math.max(1, Math.round(limit)));
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, occurred_at, message
       FROM error_logs
      ORDER BY occurred_at DESC
      LIMIT ${safe}`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    at: toIso(r.occurred_at as Date) ?? new Date(0).toISOString(),
    message: String(r.message),
  }));
}

export async function logError(message: string, opts: {
  severity?: "info" | "warning" | "error" | "critical";
  code?: string | null;
  source?: string | null;
  zoneId?: number | null;
} = {}): Promise<void> {
  await pool.execute(
    `INSERT INTO error_logs (occurred_at, severity, code, message, source, zone_id)
     VALUES (NOW(3), ?, ?, ?, ?, ?)`,
    [opts.severity ?? "error", opts.code ?? null, message.slice(0, 255), opts.source ?? null, opts.zoneId ?? null],
  );
}
