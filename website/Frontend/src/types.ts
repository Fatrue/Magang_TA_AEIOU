export type SystemMode = "auto" | "manual" | "error"; // sesuai topik MQTT system/status
export type ControlMode = "auto" | "manual"; // yang boleh dipilih operator
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

// null = sensor tidak mengirim nilai (mis. DHT22 gagal baca)
export interface SensorReading {
  soilMoisture: number | null; // %
  soilTemp: number | null; // °C
  airTemp: number | null; // °C
  airHumidity: number | null; // %RH
  ph: number | null;
  ec: number | null; // mS/cm
  receivedAt: string; // ISO 8601, waktu data terakhir diterima backend
}

export interface SensorPoint {
  at: string; // ISO 8601
  soilMoisture: number | null;
  airTemp: number | null;
  airHumidity: number | null;
}

export interface ActiveWatering {
  zone: number; // 1..13
  startedAt: string; // ISO 8601
  durationSec: number;
  source: WateringSource;
}

export interface QueueItem {
  id: string; // dibutuhkan agar satu perintah bisa dibatalkan tanpa menghentikan yang lain
  zone: number;
  durationMin: number;
  source: WateringSource;
}

export interface SystemStatus {
  online: boolean; // main controller terhubung ke broker
  mode: SystemMode;
  active: ActiveWatering | null;
  queue: QueueItem[];
  nextSchedule: string | null; // "16:00"
  batteryVolt: number | null;
  uptimeSec: number | null;
  wifiRssi: number | null; // dBm
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
  morning: string; // "08:00"
  evening: string; // "16:00"
}

export interface Calibration {
  tempOffset: number; // actual_temp = sensor_temp + tempOffset (PRD 15.2)
  humidityOffset: number;
}

export interface WateringCommand {
  zone: number;
  durationMin: number;
}

export interface IrrigationApi {
  login(username: string, password: string): Promise<LoginResult>;
  getStatus(): Promise<SystemStatus>;
  getSensors(): Promise<SensorReading>;
  getSensorSeries(hours: number): Promise<SensorPoint[]>;
  getHistory(limit?: number): Promise<HistoryEntry[]>;
  getErrors(limit?: number): Promise<ErrorLogEntry[]>;
  getSchedule(): Promise<ScheduleSettings>;
  saveSchedule(s: ScheduleSettings): Promise<void>;
  getCalibration(): Promise<Calibration>;
  saveCalibration(c: Calibration): Promise<void>;
  startWatering(cmd: WateringCommand): Promise<void>;
  stopWatering(): Promise<void>;
  cancelQueued(id: string): Promise<void>;
  setMode(mode: ControlMode): Promise<void>;
  subscribe(onChange: () => void): () => void; // mengembalikan fungsi unsubscribe
}