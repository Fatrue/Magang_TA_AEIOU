import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db.js";
import { MAX_WATERING_MIN, ZONE_COUNT, type ControlMode } from "../contract.js";
import { badRequest, conflict } from "../lib/HttpError.js";
import { publishCancelQueue, publishMode, publishStart, publishStop } from "../mqtt/outbound.js";

/**
 * Perintah Stop terakhir. Dipakai saat perangkat melaporkan valve menutup:
 * kalau penutupan terjadi tak lama setelah Stop, hasilnya "dihentikan";
 * kalau tidak, berarti durasinya habis sendiri dan hasilnya "selesai".
 */
let stopRequestedAt = 0;
export const STOP_WINDOW_MS = 60_000;
export const wasStopRequested = () => Date.now() - stopRequestedAt < STOP_WINDOW_MS;

async function recordCommand(fields: {
  userId: number | null;
  type: "start" | "stop" | "cancel_queue" | "set_mode" | "set_schedule";
  zoneId?: number | null;
  durationMin?: number | null;
  mode?: ControlMode | null;
  queueId?: string | null;
  outcome: "queued" | "sent" | "rejected";
  rejectReason?: string | null;
}): Promise<void> {
  await pool.execute(
    `INSERT INTO control_commands
       (user_id, type, zone_id, duration_min, mode, queue_id, outcome, reject_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fields.userId, fields.type, fields.zoneId ?? null, fields.durationMin ?? null,
      fields.mode ?? null, fields.queueId ?? null, fields.outcome, fields.rejectReason ?? null,
    ],
  );
}

/** Perangkat harus daring dan tidak dalam keadaan ERROR. */
async function assertDeviceReady(): Promise<void> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT online, mode FROM system_status WHERE id = 1`,
  );
  const s = rows[0];
  if (!s || !s.online) throw conflict("Controller offline, perintah tidak terkirim.");
  if (s.mode === "error") throw conflict("Sistem dalam kondisi ERROR, perintah ditolak.");
}

export async function startWatering(
  userId: number,
  zone: number,
  durationMin: number,
): Promise<{ queued: boolean; queueId: string }> {
  if (!Number.isInteger(zone) || zone < 1 || zone > ZONE_COUNT) {
    throw badRequest(`Zona harus antara 1 dan ${ZONE_COUNT}.`);
  }
  if (!Number.isInteger(durationMin) || durationMin < 1 || durationMin > MAX_WATERING_MIN) {
    throw badRequest(`Durasi harus antara 1 dan ${MAX_WATERING_MIN} menit.`);
  }

  try {
    await assertDeviceReady();
  } catch (err) {
    // Penolakan tetap dicatat. Inilah yang nanti menjawab pertanyaan
    // "kenapa penyiraman jam tiga tidak jalan".
    await recordCommand({
      userId, type: "start", zoneId: zone, durationMin,
      outcome: "rejected", rejectReason: err instanceof Error ? err.message : "ditolak",
    });
    throw err;
  }

  const queueId = randomUUID();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Dikunci agar dua permintaan yang tiba bersamaan tidak sama-sama
    // menyimpulkan "tidak ada yang aktif" dan mengirim dua perintah.
    const [activeRows] = await conn.execute<RowDataPacket[]>(
      `SELECT id FROM watering_events WHERE result = 'berjalan' LIMIT 1 FOR UPDATE`,
    );
    const busy = activeRows.length > 0;

    await conn.execute(
      `INSERT INTO control_commands (user_id, type, zone_id, duration_min, queue_id, outcome)
       VALUES (?, 'start', ?, ?, ?, ?)`,
      [userId, zone, durationMin, queueId, busy ? "queued" : "sent"],
    );

    await conn.commit();

    // Diterbitkan setelah commit. Kalau diterbitkan lebih dulu lalu
    // transaksi gagal, valve terbuka tanpa catatan apa pun.
    if (!busy) publishStart(zone, durationMin);
    return { queued: busy, queueId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Menghentikan yang aktif DAN mengosongkan antrean. Dua akibat, satu perintah. */
export async function stopWatering(userId: number): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE control_commands SET outcome = 'cancelled'
        WHERE type = 'start' AND outcome = 'queued'`,
    );
    await conn.execute(
      `INSERT INTO control_commands (user_id, type, outcome) VALUES (?, 'stop', 'sent')`,
      [userId],
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  stopRequestedAt = Date.now();
  publishStop();
}

export async function cancelQueued(userId: number, queueId: string): Promise<void> {
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE control_commands SET outcome = 'cancelled'
      WHERE queue_id = ? AND type = 'start' AND outcome = 'queued'`,
    [queueId],
  );
  // 409, bukan 404: perintahnya memang pernah ada, hanya keadaannya berubah.
  if (res.affectedRows === 0) {
    throw conflict("Perintah itu sudah berjalan atau sudah dibatalkan.");
  }
  await recordCommand({ userId, type: "cancel_queue", queueId, outcome: "sent" });
  publishCancelQueue(queueId);
}

export async function setMode(userId: number, mode: ControlMode): Promise<void> {
  await assertDeviceReady();
  await recordCommand({ userId, type: "set_mode", mode, outcome: "sent" });
  publishMode(mode);
}
