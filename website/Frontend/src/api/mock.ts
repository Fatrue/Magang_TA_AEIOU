import type {
  ActiveWatering, Calibration, ControlMode, ErrorLogEntry, HistoryEntry, IrrigationApi,
  QueueItem, ScheduleSettings, SensorPoint, WateringSource,
} from "../types";
import { MAX_WATERING_MIN, ZONE_COUNT } from "../lib/zones";

// Server tiruan di memori. Hilang saat halaman di-refresh (normal).
const bootTime = Date.now();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

let mode: ControlMode = "auto";
let active: ActiveWatering | null = null;
let queue: QueueItem[] = [];
const history: HistoryEntry[] = [];
let nextId = 1;
let nextQueueId = 1;

// Gangguan yang bisa dinyalakan dari Console browser. Tanpa ini, mode tiruan selalu
// "sehat" sehingga banner offline/error/data-basi tidak pernah bisa dilihat atau diuji.
const fault = { offline: false, error: null as string | null, staleMin: 0 };
const errors: ErrorLogEntry[] = [{ id: 1, at: new Date(bootTime - 3 * 3600_000).toISOString(), message: "Sensor timeout (contoh data)" }];
let schedule: ScheduleSettings = { morning: "08:00", evening: "16:00" };
let calibration: Calibration = { tempOffset: 0, humidityOffset: 0 };

function begin(zone: number, durationMin: number, source: WateringSource) {
  active = { zone, startedAt: new Date().toISOString(), durationSec: durationMin * 60, source };
}

function finish(result: HistoryEntry["result"]) {
  if (!active) return;
  history.unshift({
    id: nextId++, zone: active.zone, startedAt: active.startedAt,
    durationMin: Math.max(1, Math.round(active.durationSec / 60)), result, source: active.source,
  });
  active = null;
  const next = queue.shift(); // antrean berikutnya langsung jalan
  if (next) begin(next.zone, next.durationMin, next.source); // sumber asli dipertahankan, jangan dipaksa "manual"
}

setInterval(() => {
  if (active && Date.now() - Date.parse(active.startedAt) >= active.durationSec * 1000) {
    finish("selesai");
    emit();
  }
}, 1000);

function nextScheduleTime(): string {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const list = [schedule.morning, schedule.evening]
    .map((t) => { const [h, m] = t.split(":").map(Number); return { t, v: h * 60 + m }; })
    .sort((a, b) => a.v - b.v);
  return (list.find((x) => x.v > cur) ?? list[0]).t;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export const mockApi: IrrigationApi = {
  async login(username, password) {
    if (username === "admin" && password === "admin123") return { token: "mock-admin", user: { name: "Admin", role: "admin" } };
    if (username === "viewer" && password === "viewer123") return { token: "mock-viewer", user: { name: "Pengamat", role: "viewer" } };
    throw new Error("Username atau password salah");
  },
  async getStatus() {
    return {
      online: !fault.offline,
      mode: fault.error ? "error" : mode,
      active: active && { ...active },
      queue: [...queue],
      nextSchedule: nextScheduleTime(),
      uptimeSec: Math.floor((Date.now() - bootTime) / 1000), wifiRssi: fault.offline ? null : -58,
      lastError: fault.error,
    };
  },
  async getSensors() {
    const wave = Math.sin(Date.now() / 120000);
    return {
      soilMoisture: round1(42 + 6 * wave), soilTemp: round1(28.4 + wave), airTemp: round1(29 + 2 * wave),
      airHumidity: round1(72 - 5 * wave), ph: 6.8, ec: 1.2,
      receivedAt: new Date(Date.now() - fault.staleMin * 60_000).toISOString(),
    };
  },
  async getSensorSeries(hours) {
    const step = 10 * 60_000; // 10 menit
    const n = Math.round((hours * 3600_000) / step);
    const now = Date.now();
    const points: SensorPoint[] = [];
    for (let i = 0; i < n; i++) {
      points.push({
        at: new Date(now - (n - i) * step).toISOString(),
        soilMoisture: round1(50 + 12 * Math.sin(i / 9)),
        airTemp: round1(28 + 5 * Math.sin(i / 20 + 1)),
        airHumidity: round1(70 - 12 * Math.sin(i / 20 + 1)),
      });
    }
    return points;
  },
  async getHistory(limit = 20) { return history.slice(0, limit); },
  async getErrors(limit = 50) { return errors.slice(0, limit); },
  async getSchedule() { return { ...schedule }; },
  async saveSchedule(s) { schedule = { ...s }; emit(); },
  async getCalibration() { return { ...calibration }; },
  async saveCalibration(c) { calibration = { ...c }; emit(); },
  async startWatering({ zone, durationMin }) {
    if (zone < 1 || zone > ZONE_COUNT || durationMin < 1 || durationMin > MAX_WATERING_MIN) throw new Error("Perintah tidak valid");
    if (fault.offline) throw new Error("Controller offline, perintah tidak terkirim");
    if (fault.error) throw new Error("Sistem dalam kondisi ERROR, perintah ditolak");
    if (active) queue.push({ id: `q${nextQueueId++}`, zone, durationMin, source: "manual" }); // interlock: 1 valve saja, sisanya antre
    else begin(zone, durationMin, "manual");
    emit();
  },
  async stopWatering() {
    queue = []; // CANCEL = hentikan yang aktif dan batalkan antrean (asumsi, samakan dengan firmware)
    finish("dihentikan");
    emit();
  },
  async cancelQueued(id) {
    queue = queue.filter((q) => q.id !== id);
    emit();
  },
  async setMode(m) { mode = m; emit(); },
  subscribe(fn) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};

// Hanya saat `npm run dev`. Tidak ikut ke build produksi.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).mock = {
    offline: (on = true) => { fault.offline = on; emit(); },
    error: (msg: string | null = "Valve timeout (simulasi)") => { fault.error = msg; emit(); },
    stale: (minutes = 20) => { fault.staleMin = minutes; emit(); },
    reset: () => { fault.offline = false; fault.error = null; fault.staleMin = 0; emit(); },
  };
  console.info("[mock] Simulasi gangguan: mock.offline() · mock.error() · mock.stale(20) · mock.reset()");
}
