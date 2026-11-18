// Salinan kontrak dari Frontend/src/types.ts. Harus selalu sama persis.
// Kalau frontend mengubah bentuk data, file ini yang pertama menyesuaikan.

export type SystemMode = "auto" | "manual" | "error";
export type ControlMode = "auto" | "manual";
export type WateringSource = "auto" | "manual";
export type UserRole = "admin" | "viewer";

export interface User {
  name: string;
  role: UserRole;
}

export interface LoginResult {
  token: string;
  user: User;
}

export interface SensorReading {
  soilMoisture: number | null;
  soilTemp: number | null;
  airTemp: number | null;
  airHumidity: number | null;
  ph: number | null;
  ec: number | null;
  receivedAt: string;
}

export interface SensorPoint {
  at: string;
  soilMoisture: number | null;
  airTemp: number | null;
  airHumidity: number | null;
}

export interface ActiveWatering {
  zone: number;
  startedAt: string;
  durationSec: number;
  source: WateringSource;
}

export interface QueueItem {
  id: string;
  zone: number;
  durationMin: number;
  source: WateringSource;
}

export interface SystemStatus {
  online: boolean;
  mode: SystemMode;
  active: ActiveWatering | null;
  queue: QueueItem[];
  nextSchedule: string | null;
  batteryVolt: number | null; // hapus bila sudah dihapus dari frontend
  uptimeSec: number | null;
  wifiRssi: number | null;
  lastError: string | null;
}

export interface HistoryEntry {
  id: number;
  zone: number;
  startedAt: string;
  durationMin: number;
  result: "selesai" | "dihentikan" | "error";
  source: WateringSource;
}

export interface ErrorLogEntry {
  id: number;
  at: string;
  message: string;
}

export interface ScheduleSettings {
  first: string;
  second: string;
}

export const ZONE_COUNT = 13;
export const MAX_WATERING_MIN = 5;
export const MIN_WATERING_MIN = 0.5;
export const validManualDuration = (minutes: number) =>
  Number.isFinite(minutes) && minutes >= MIN_WATERING_MIN && minutes <= MAX_WATERING_MIN &&
  Math.abs(minutes * 60 - Math.round(minutes * 60)) < 0.000001;
