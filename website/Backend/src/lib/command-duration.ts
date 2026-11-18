// Perintah baru menyimpan detik utuh. Riwayat lama memakai menit.
export const commandDurationSecSql = `COALESCE(
  CAST(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.durationSec')) AS UNSIGNED),
  ROUND(duration_min * 60)
)`;

export function commandDurationColumns(durationMin: number | null | undefined) {
  if (durationMin == null) return { minutes: null, payload: null };

  return {
    minutes: Number.isInteger(durationMin) ? durationMin : null,
    payload: JSON.stringify({ durationSec: Math.round(durationMin * 60) }),
  };
}
