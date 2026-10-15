export const ZONE_COUNT = 13;
export const MAX_WATERING_MIN = 30; // sama dengan MAX_WATERING_TIME di PRD 11.2.3
export const ZONE_PREFIX = "V"; // "V" = label LCD/PRD (V01..V13). Ganti ke "Z" jika ingin label Figma.
export const ZONES = Array.from({ length: ZONE_COUNT }, (_, i) => i + 1);
export const zoneLabel = (n: number) => `${ZONE_PREFIX}${String(n).padStart(2, "0")}`;