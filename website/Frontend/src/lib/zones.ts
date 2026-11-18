export const ZONE_COUNT = 13;
export const MAX_WATERING_MIN = 5;
export const MIN_WATERING_SEC = 30;
export const MAX_WATERING_SEC = MAX_WATERING_MIN * 60;

export const durationLabel = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds));
  return [Math.floor(total / 3600) ? `${Math.floor(total / 3600)} jam` : "", Math.floor(total / 60) % 60 ? `${Math.floor(total / 60) % 60} menit` : "", total % 60 ? `${total % 60} detik` : ""].filter(Boolean).join(" ") || "0 detik";
};
export const ZONE_PREFIX = "V"; // "V" = label LCD/PRD (V01..V13). Ganti ke "Z" jika ingin label Figma.
export const ZONES = Array.from({ length: ZONE_COUNT }, (_, i) => i + 1);
export const zoneLabel = (n: number) => `${ZONE_PREFIX}${String(n).padStart(2, "0")}`;
