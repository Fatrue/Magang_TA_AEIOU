import { api } from "../api";
import { PageHeader } from "../components/PageHeader";
import { useAsync } from "../hooks/useAsync";
import { formatDateTime } from "../lib/format";
import { zoneLabel } from "../lib/zones";
import type { HistoryEntry } from "../types";

const resultLabel: Record<HistoryEntry["result"], { text: string; tone: "ok" | "warn" | "bad" }> = {
  selesai: { text: "Selesai", tone: "ok" },
  dihentikan: { text: "Dihentikan", tone: "warn" },
  error: { text: "Error", tone: "bad" },
};

export function HistoryPage() {
  const history = useAsync(() => api.getHistory(100), []);

  return (
    <main className="page">
      <PageHeader kicker="Catatan" title="Riwayat" subtitle="Penyiraman terbaru per zona." />
      {history.loading && <p className="empty">Memuat riwayat…</p>}
      {history.error && <div className="banner bad">{history.error} <button className="link-button" onClick={history.reload}>Coba lagi</button></div>}
      {history.data && history.data.length === 0 && <p className="empty">Belum ada riwayat penyiraman.</p>}
      {history.data && history.data.length > 0 && (
        <section className="card">
          {history.data.map((h) => (
            <div className="row" key={h.id}>
              <span>{formatDateTime(h.startedAt)} · {zoneLabel(h.zone)} · {h.source === "auto" ? "Otomatis" : "Manual"}</span>
              <strong>{h.durationMin} menit <em className={`pill ${resultLabel[h.result].tone}`}>{resultLabel[h.result].text}</em></strong>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}