import type { ControlMode, ScheduleSettings } from "../contract.js";
import { publish } from "./client.js";
import { OUT } from "./topics.js";

export function publishStart(zone: number, durationMin: number): void {
  // Durasi lebih dulu, baru nomor valve. Kalau terbalik, firmware bisa
  // menerima perintah valve sementara durasi masih bernilai perintah lama.
  publish(OUT.duration, String(durationMin));
  publish(OUT.valve, String(zone));
}

export const publishStop = () => publish(OUT.stop, "1");

export const publishMode = (mode: ControlMode) => publish(OUT.mode, mode.toUpperCase());

export const publishCancelQueue = (queueId: string) => publish(OUT.cancelQueue, queueId);

export const publishSchedule = (s: ScheduleSettings) =>
  publish(OUT.setSchedule, JSON.stringify({ first: s.first, second: s.second }));
