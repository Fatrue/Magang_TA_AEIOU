import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db.js";
import { validManualDuration, ZONE_COUNT, type ControlMode } from "../contract.js";
import { badRequest, conflict } from "../lib/HttpError.js";
import { commandDurationColumns, commandDurationSecSql } from "../lib/command-duration.js";
import { publishMode, publishStart, publishStop } from "../mqtt/outbound.js";

// Satu proses backend: HTTP dan laporan MQTT memakai kunci yang sama.
// Perintah yang telah dikirim tetapi belum diakui juga dihitung sibuk.
let controlTail: Promise<unknown> = Promise.resolve();
export function withWateringLock<T>(action: () => Promise<T>): Promise<T> {
  const result = controlTail.then(action);
  controlTail = result.catch(() => undefined);
  return result;
}

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
  const duration = commandDurationColumns(fields.durationMin);
  await pool.execute(
    `INSERT INTO control_commands
       (user_id, type, zone_id, duration_min, mode, queue_id, outcome, reject_reason, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fields.userId, fields.type, fields.zoneId ?? null, duration.minutes,
      fields.mode ?? null, fields.queueId ?? null, fields.outcome, fields.rejectReason ?? null,
      duration.payload,
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

// Pemanggil wajib memegang withWateringLock. Hanya satu pesan mulai boleh
// menunggu pengakuan controller; pesan idle berulang tidak melewati kunci ini.
export async function dispatchNextQueued(): Promise<void> {
  const [status] = await pool.execute<RowDataPacket[]>(`SELECT online, mode FROM system_status WHERE id = 1`);
  if (!status[0]?.online || status[0]?.mode === "error") return;
  const [active] = await pool.execute<RowDataPacket[]>(`SELECT id FROM watering_events WHERE result = 'berjalan' LIMIT 1`);
  const [pending] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM control_commands WHERE type = 'start' AND outcome IN ('sent','running') LIMIT 1`,
  );
  if (active.length || pending.length) return;
  const [next] = await pool.execute<RowDataPacket[]>(
    `SELECT id, zone_id, ${commandDurationSecSql} AS duration_sec FROM control_commands
      WHERE type = 'start' AND outcome = 'queued' ORDER BY created_at, id LIMIT 1`,
  );
  const command = next[0];
  if (!command) return;
  stopRequestedAt = 0;
  await pool.execute(`UPDATE control_commands SET outcome = 'sent' WHERE id = ? AND outcome = 'queued'`, [command.id]);
  try {
    await publishStart(Number(command.zone_id), Number(command.duration_sec) / 60);
  } catch (err) {
    // Jangan kirim ulang otomatis: valve mungkin sudah menerima pesan
    // meski pengakuannya hilang. Stop eksplisit diperlukan sebelum siklus baru.
    await pool.execute(`UPDATE control_commands SET reject_reason = ? WHERE id = ?`,
      ["Pengiriman belum terkonfirmasi. Periksa perangkat dan gunakan Stop.", command.id]);
    throw err;
  }
}

export async function startWatering(
  userId: number,
  durationMin: number,
  selectedZone?: number,
): Promise<void> {
  if (!validManualDuration(durationMin)) {
    throw badRequest("Durasi harus 30 detik sampai 5 menit per jalur, dalam detik bulat.");
  }
  if (selectedZone !== undefined && (!Number.isInteger(selectedZone) || selectedZone < 1 || selectedZone > ZONE_COUNT)) {
    throw badRequest("Jalur penyiraman tidak valid.");
  }

  try {
    await assertDeviceReady();
  } catch (err) {
    // Penolakan tetap dicatat. Inilah yang nanti menjawab pertanyaan
    // "kenapa penyiraman jam tiga tidak jalan".
    await recordCommand({
      userId, type: "start", durationMin, zoneId: selectedZone,
      outcome: "rejected", rejectReason: err instanceof Error ? err.message : "ditolak",
    });
    throw err;
  }

  await withWateringLock(async () => {
    await assertDeviceReady();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Satu jalur boleh ditambahkan ke antrean. Siklus 13 jalur dimulai saat idle.
      if (selectedZone === undefined) {
        const [activeRows] = await conn.execute<RowDataPacket[]>(
          `SELECT id FROM watering_events WHERE result = 'berjalan' LIMIT 1 FOR UPDATE`,
        );
        const [pendingRows] = await conn.execute<RowDataPacket[]>(
          `SELECT id FROM control_commands WHERE type = 'start'
           AND outcome IN ('queued','sent','running') LIMIT 1 FOR UPDATE`,
        );
        if (activeRows.length || pendingRows.length) {
          throw conflict("Selesaikan atau hentikan penyiraman sebelum memulai Semua Jalur.");
        }
      }

      const firstZone = selectedZone ?? 1;
      const lastZone = selectedZone ?? ZONE_COUNT;
      const duration = commandDurationColumns(durationMin);
      for (let zone = firstZone; zone <= lastZone; zone++) {
        await conn.execute(
          `INSERT INTO control_commands (user_id, type, zone_id, duration_min, queue_id, outcome, payload)
           VALUES (?, 'start', ?, ?, ?, 'queued', ?)`,
          [userId, zone, duration.minutes, randomUUID(), duration.payload],
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    await dispatchNextQueued();
  });
}

/** Menghentikan yang aktif DAN mengosongkan antrean. Dua akibat, satu perintah. */
export async function stopWatering(userId: number): Promise<void> {
  await withWateringLock(async () => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE control_commands SET outcome = 'cancelled'
        WHERE type = 'start' AND outcome IN ('queued','sent')`,
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
  await publishStop();
  });
}

export async function cancelQueued(userId: number, queueId: string): Promise<void> {
  await withWateringLock(async () => {
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
  // Antrean web dimiliki backend, jadi tidak perlu mengirim id ini ke firmware.
  });
}

export async function cancelAllQueued(userId: number): Promise<void> {
  await withWateringLock(async () => {
    await pool.execute(`UPDATE control_commands SET outcome = 'cancelled' WHERE type = 'start' AND outcome = 'queued'`);
    await recordCommand({ userId, type: "cancel_queue", outcome: "sent" });
  });
}

export async function setMode(userId: number, mode: ControlMode): Promise<void> {
  await withWateringLock(async () => {
    await assertDeviceReady();
    await recordCommand({ userId, type: "set_mode", mode, outcome: "sent" });
    await publishMode(mode);
  });
}
