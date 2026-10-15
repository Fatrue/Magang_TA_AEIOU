import { api } from "../api";
import { PageHeader } from "../components/PageHeader";
import { useIrrigation } from "../context/IrrigationContext";
import { useAsync } from "../hooks/useAsync";
import { batteryState, formatDateTime, formatUptime, modeLabel, num } from "../lib/format";

export function SystemPage() {
  const { status } = useIrrigation();
  const errors = useAsync(() => api.getErrors(50), []);
  const battery = batteryState(status.batteryVolt);

  return (
    <main className="page">
      <PageHeader kicker="Kesehatan sistem" title="Sistem & Error" subtitle="Status perangkat dan log gangguan." />

      <section className="card">
        <div className="row"><span>Controller</span><strong><em className={`pill ${status.online ? "ok" : "bad"}`}>{status.online ? "Online" : "Offline"}</em></strong></div>
        <div className="row"><span>Mode</span><strong>{modeLabel(status.mode)}</strong></div>
        <div className="row"><span>Baterai</span><strong>{num(status.batteryVolt, 1, " V")} <em className={`pill ${battery.tone}`}>{battery.label}</em></strong></div>
        <div className="row"><span>Uptime</span><strong>{formatUptime(status.uptimeSec)}</strong></div>
        <div className="row"><span>Sinyal WiFi</span><strong>{status.wifiRssi === null ? "—" : `${status.wifiRssi} dBm`}</strong></div>
        <div className="row"><span>Jadwal berikutnya</span><strong>{status.nextSchedule ?? "—"}</strong></div>
        <div className="row"><span>Antrean</span><strong>{status.queue.length} perintah</strong></div>
      </section>

      <section>
        <div className="section-heading"><div><span className="section-kicker">Log</span><h2>Riwayat gangguan</h2></div></div>
        {errors.loading && <p className="empty">Memuat log…</p>}
        {errors.error && <div className="banner bad">{errors.error} <button className="link-button" onClick={errors.reload}>Coba lagi</button></div>}
        {errors.data && errors.data.length === 0 && <p className="empty">Tidak ada gangguan tercatat.</p>}
        {errors.data && errors.data.length > 0 && (
          <div className="card">
            {errors.data.map((e) => (
              <div className="row" key={e.id}><span>{formatDateTime(e.at)}</span><strong>{e.message}</strong></div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}