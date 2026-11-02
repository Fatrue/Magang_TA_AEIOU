import type { SystemMode } from "../types";

function trapezoid(x: number, a: number, b: number, c: number, d: number): number {
  if (x < a || x > d) return 0;
  if (x >= b && x <= c) return 1;
  if (x < b) return b === a ? 1 : (x - a) / (b - a);
  return d === c ? 1 : (d - x) / (d - c);
}

type FuzzySet = { label: string; points: [number, number, number, number] };

function highest(v: number | null, sets: FuzzySet[]): string {
  if (v === null) return "Tidak ada data";
  let best = sets[0];
  let bestDegree = -1;
  for (const s of sets) {
    const degree = trapezoid(v, ...s.points);
    if (degree > bestDegree) {
      bestDegree = degree;
      best = s;
    }
  }
  return best?.label ?? "Tidak ada data";
}

// Nilai-nilai ini HARUS sama dengan himpunan fuzzy di firmware. Kalau
// firmware diubah, berkas ini ikut diubah — kalau tidak, layar akan
// menyebut "Lembap" sementara perangkat memutuskan berdasarkan "Kering".
const SOIL_MOISTURE: FuzzySet[] = [
  { label: "Kering", points: [0, 0, 30, 40] },
  { label: "Lembap", points: [30, 45, 45, 60] },
  { label: "Basah", points: [50, 65, 100, 100] },
];

const AIR_TEMP: FuzzySet[] = [
  { label: "Dingin", points: [0, 0, 20, 24] },
  { label: "Normal", points: [22, 26, 26, 30] },
  { label: "Panas", points: [28, 32, 40, 40] },
];

const AIR_HUMIDITY: FuzzySet[] = [
  { label: "Rendah", points: [0, 0, 45, 55] },
  { label: "Sedang", points: [45, 60, 60, 75] },
  { label: "Tinggi", points: [65, 75, 100, 100] },
];

export const moistureNote = (v: number | null) => highest(v, SOIL_MOISTURE);
export const airTempNote = (v: number | null) => highest(v, AIR_TEMP);
export const airHumidityNote = (v: number | null) => highest(v, AIR_HUMIDITY);


export const num = (v: number | null, digits = 0, unit = "") => (v === null ? "—" : `${v.toFixed(digits)}${unit}`);

export const formatRemaining = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const formatClock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export const formatUptime = (sec: number | null) => {
  if (sec === null) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return [d > 0 ? `${d} hari` : "", d > 0 || h > 0 ? `${h} jam` : "", `${m} menit`].filter(Boolean).join(" ");
};

export const minutesAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));

export const modeLabel = (m: SystemMode) => (m === "auto" ? "Otomatis" : m === "manual" ? "Manual" : "Error");

