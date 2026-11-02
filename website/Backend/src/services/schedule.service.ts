import type { RowDataPacket } from "mysql2";
import { pool } from "../db.js";
import type { ScheduleSettings } from "../contract.js";
import { toHhMm, toSqlTime } from "../lib/time.js";

const DEFAULTS: ScheduleSettings = { first: "08:00", second: "16:00" };

/**
 * Tabel ini menyimpan riwayat, satu baris per perubahan, lengkap dengan
 * siapa yang mengubah. Jadi yang berlaku adalah baris terbaru — bukan
 * baris pertama, dan bukan seluruh isi tabel.
 */
export async function getSchedule(): Promise<ScheduleSettings> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT first_time, second_time
       FROM schedule_settings
      ORDER BY updated_at DESC, id DESC
      LIMIT 1`,
  );
  const r = rows[0];
  if (!r) return { ...DEFAULTS };
  return {
    first: toHhMm(r.first_time as string) ?? DEFAULTS.first,
    second: toHhMm(r.second_time as string) ?? DEFAULTS.second,
  };
}

export async function saveSchedule(userId: number, s: ScheduleSettings): Promise<void> {
  await pool.execute(
    `INSERT INTO schedule_settings (first_time, second_time, updated_by) VALUES (?, ?, ?)`,
    [toSqlTime(s.first), toSqlTime(s.second), userId],
  );
}
