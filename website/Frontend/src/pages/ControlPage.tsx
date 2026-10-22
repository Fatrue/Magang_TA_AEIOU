import { useState } from "react";
import { api } from "../api";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Icon, type IconName } from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { useIrrigation } from "../context/IrrigationContext";
import { useAsync } from "../hooks/useAsync";
import { formatRemaining } from "../lib/format";
import { MAX_WATERING_MIN, ZONES, zoneLabel } from "../lib/zones";
import type { ControlMode } from "../types";

const PRESETS = [5, 10, 15, 20];
const clampMin = (n: number) => Math.min(MAX_WATERING_MIN, Math.max(1, Math.round(n) || 1));

const modes: { id: ControlMode; name: string; detail: string; icon: IconName }[] = [
  { id: "auto", name: "Otomatis", detail: "Siram otomatis sesuai jadwal penyiraman yang sudah ditentukan", icon: "leaf" },
  { id: "manual", name: "Manual", detail: "Pilih zona dan durasi penyiraman", icon: "control" },
];

export function ControlPage() {
  const { status, remainingSec } = useIrrigation();
  const { canControl } = useAuth();
  const [zone, setZone] = useState(1);
  const [preset, setPreset] = useState<number | "custom">(15);
  const [customText, setCustomText] = useState("15");
  const [confirm, setConfirm] = useState<"start" | "stop" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const active = status.active;
  const mode = status.mode;
  const locked = !canControl || mode === "error" || !status.online;
  const durationMin = preset === "custom" ? clampMin(Number(customText)) : preset;
  const modeName = modes.find((m) => m.id === mode)?.name ?? "";
  // Jam diambil dari jadwal yang tersimpan, bukan ditulis tetap, agar teksnya
  // ikut berubah saat jadwal diubah di Lainnya > Jadwal.
  const schedule = useAsync(() => api.getSchedule(), []);
  // Nilai di luar 1-30 dibetulkan diam-diam oleh clampMin. Beri tahu operator, jangan hanya diperbaiki.
  const customAdjusted = preset === "custom" && customText.trim() !== "" && Number(customText) !== durationMin;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <main className="page control-page">
      <div className="page-title"><span className="section-kicker">Pengoperasian</span><h2>Kontrol Penyiraman</h2><p>Pilih cara penyiraman yang paling sesuai.</p></div>

      {!canControl && <div className="banner warn">Akun Anda hanya dapat melihat. Kontrol penyiraman hanya untuk admin.</div>}
      {mode === "error" && <div className="banner bad">Sistem dalam kondisi ERROR. Periksa menu Lainnya, Sistem &amp; Error. Kontrol dinonaktifkan sampai direset di perangkat.</div>}
      {!status.online && <div className="banner bad">Controller offline. Perintah tidak dapat dikirim.</div>}
      {message && <div className="banner bad">{message}</div>}

      {active && (
        <section className="active-watering-card">
          <div className="active-water-icon"><Icon name="droplet" size={26} /></div>
          <div className="active-water-copy"><span><i /> SEDANG MENYIRAM</span><h2>{zoneLabel(active.zone)}</h2><p>{formatRemaining(remainingSec)} tersisa</p></div>
          <Button className="stop-button" onClick={() => setConfirm("stop")} disabled={!canControl || busy}>Stop Penyiraman</Button>
        </section>
      )}

      <section>
        <div className="step-heading"><span>1</span><div><h3>Pilih Mode</h3><p>Mode aktif ditandai warna hijau.</p></div></div>
        <div className="mode-grid two">
          {modes.map((item) => (
            <Button key={item.id} className={`mode-card ${mode === item.id ? "selected" : ""}`} aria-pressed={mode === item.id} disabled={locked || busy} onClick={() => void run(() => api.setMode(item.id))}>
              <span className="mode-icon"><Icon name={item.icon} /></span><strong>{item.name}</strong><small>{item.detail}</small>
              {mode === item.id && <span className="mode-check"><Icon name="check" size={14} /></span>}
            </Button>
          ))}
        </div>
      </section>

      {mode === "manual" ? (
        <div className="manual-panel">
          <section>
            <div className="step-heading"><span>2</span><div><h3>Pilih Zona</h3><p>Hanya satu zona dapat disiram.</p></div></div>
            <div className="control-zone-grid">{ZONES.map((n) => <Button key={n} className={zone === n ? "selected" : ""} aria-pressed={zone === n} aria-label={`Zona ${zoneLabel(n)}`} onClick={() => setZone(n)}>{zoneLabel(n)}{zone === n && <Icon name="check" size={15} />}</Button>)}</div>
          </section>
          <section>
            <div className="step-heading"><span>3</span><div><h3>Pilih Durasi</h3><p>Durasi penyiraman untuk {zoneLabel(zone)}.</p></div></div>
            <div className="duration-grid">
              {PRESETS.map((m) => <Button key={m} className={preset === m ? "selected" : ""} aria-pressed={preset === m} onClick={() => setPreset(m)}>{m} menit</Button>)}
              <Button className={preset === "custom" ? "selected" : ""} aria-pressed={preset === "custom"} onClick={() => setPreset("custom")}>Custom</Button>
            </div>
            {preset === "custom" && (
              <>
                <div className="custom-duration">
                  <input type="number" min={1} max={MAX_WATERING_MIN} value={customText} onChange={(e) => setCustomText(e.target.value)} aria-label="Durasi dalam menit" aria-describedby="durasi-catatan" />
                  <span>menit (1–{MAX_WATERING_MIN})</span>
                </div>
                <p id="durasi-catatan" className={customAdjusted ? "field-note adjusted" : "field-note"}>
                  {customAdjusted
                    ? `Disesuaikan menjadi ${durationMin} menit. Batas keamanan sistem 1–${MAX_WATERING_MIN} menit, firmware memaksa valve mati di ${MAX_WATERING_MIN} menit (PRD 11.2.3).`
                    : `Batas keamanan sistem: 1–${MAX_WATERING_MIN} menit.`}
                </p>
              </>
            )}
          </section>
          <div className="start-panel">
            <div><span>Siap menyiram</span><strong>{zoneLabel(zone)} · {durationMin} menit</strong></div>
            <Button className="primary-button" disabled={locked || busy} onClick={() => setConfirm("start")}><Icon name="droplet" /> {active ? "Tambah ke Antrean" : "Mulai Siram"}</Button>
            {active && <p>Zona ini akan masuk antrean dan berjalan setelah penyiraman aktif selesai.</p>}
          </div>
        </div>
      ) : (
        <div className="mode-info"><span className="sensor-icon green"><Icon name="leaf" /></span><div><strong>Mode {modeName || "—"} aktif</strong><p>Penyiraman otomatis akan dilakukan pada {schedule.data ? `${schedule.data.first} dan ${schedule.data.second}` : "jadwal siram pertama dan kedua"}.</p></div></div>
      )}

      {status.queue.length > 0 && (
        <div className="queue-list">
          <strong>Antrean ({status.queue.length})</strong>
          <ul>
            {status.queue.map((q) => (
              <li key={q.id}>
                <span>{zoneLabel(q.zone)} · {q.durationMin} menit · {q.source === "auto" ? "Otomatis" : "Manual"}</span>
                <Button className="link-button" disabled={!canControl || busy} aria-label={`Batalkan ${zoneLabel(q.zone)} dari antrean`} onClick={() => void run(() => api.cancelQueued(q.id))}>Batalkan</Button>
              </li>
            ))}
          </ul>
          <p className="hint">Membatalkan satu perintah tidak menghentikan penyiraman yang sedang berjalan. Tombol Stop menghentikan yang aktif <em>sekaligus</em> seluruh antrean (keputusan D5).</p>
        </div>
      )}

      {confirm === "start" && (
        <ConfirmDialog tone="primary" busy={busy} title="Mulai penyiraman?" confirmLabel="Ya, Mulai"
          message={`${zoneLabel(zone)} akan disiram ${durationMin} menit.${active ? " Perintah masuk antrean setelah penyiraman aktif selesai." : ""}`}
          onCancel={() => setConfirm(null)} onConfirm={() => void run(() => api.startWatering({ zone, durationMin }))} />
      )}
      {confirm === "stop" && active && (
        <ConfirmDialog tone="danger" busy={busy} title="Hentikan penyiraman?" confirmLabel="Ya, Hentikan"
          message={`Penyiraman ${zoneLabel(active.zone)} akan dihentikan${status.queue.length > 0 ? ` dan ${status.queue.length} perintah dalam antrean dibatalkan` : ""}.`}
          onCancel={() => setConfirm(null)} onConfirm={() => void run(() => api.stopWatering())} />
      )}
    </main>
  );
}