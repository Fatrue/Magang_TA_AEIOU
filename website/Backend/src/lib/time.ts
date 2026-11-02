/** DATETIME dari MySQL -> ISO 8601 untuk JSON. */
export function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Kolom TIME MySQL ("16:00:00") -> "16:00" yang diharapkan frontend. */
export function toHhMm(value: string | null): string | null {
  return value === null ? null : String(value).slice(0, 5);
}

/** "16:00" -> "16:00:00" untuk disimpan ke kolom TIME. */
export const toSqlTime = (hhmm: string) => `${hhmm}:00`;

/** Angka atau null; menolak NaN agar tidak lolos ke JSON sebagai null diam-diam. */
export function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
