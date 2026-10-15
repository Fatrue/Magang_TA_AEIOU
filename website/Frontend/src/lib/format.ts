import type { SystemMode } from "../types";

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

// Label tampilan. Himpunan fuzzy di PRD 9.3 sengaja SALING TUMPANG TINDIH
// (Dry 0-30, Optimal 20-70, Wet 60-100) karena itu sifat logika fuzzy, jadi tidak bisa
// dipakai langsung sebagai batas tegas. Angka di bawah hanya untuk teks di kartu.
// Kalau backend sudah mengirim label hasil derajat keanggotaan tertinggi, pakai itu dan hapus fungsi ini.
export const moistureNote = (v: number | null) => (v === null ? "Tidak ada data" : v < 25 ? "Kering" : v <= 60 ? "Cukup lembap" : "Basah");

// LiFePO4 12.8 V: rentang kerja wajar 10.0-14.6 V, normal di atas 12.5 V (PRD 15.3).
// Kurva LiFePO4 sangat datar, jadi persen dari tegangan tidak andal - tampilkan Volt saja.
export const BATTERY_MIN_V = 10.0;
export const BATTERY_MAX_V = 14.6;
export const BATTERY_OK_V = 12.5;

export type BatteryStatus = "unknown" | "ok" | "low" | "invalid";

// "invalid" penting: PRD 13.1/14.3 sendiri menulis 4.2 V (angka Li-ion sel tunggal, bukan LiFePO4).
// Kalau firmware ikut salah, UI harus menandainya, bukan menampilkannya seolah wajar.
export const batteryState = (v: number | null): { status: BatteryStatus; label: string; tone: "ok" | "warn" | "bad" } => {
  if (v === null) return { status: "unknown", label: "Tidak ada data", tone: "warn" };
  if (v < BATTERY_MIN_V || v > BATTERY_MAX_V) return { status: "invalid", label: "Nilai tidak wajar", tone: "bad" };
  if (v >= BATTERY_OK_V) return { status: "ok", label: "Normal", tone: "ok" };
  return { status: "low", label: "Rendah", tone: "warn" };
};

export const modeLabel = (m: SystemMode) => (m === "auto" ? "Otomatis" : m === "manual" ? "Manual" : "Error");