import { useState } from "react";
import { api } from "../api";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Icon } from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { useIrrigation } from "../context/IrrigationContext";
import { formatRemaining } from "../lib/format";
import { MIN_WATERING_SEC, MAX_WATERING_SEC, ZONES, durationLabel, zoneLabel } from "../lib/zones";

const PRESETS = [30, 60, 120, 180];
const clampSeconds = (n: number) => Math.min(MAX_WATERING_SEC, Math.max(MIN_WATERING_SEC, Number.isFinite(n) ? Math.round(n) : MIN_WATERING_SEC));

export function ControlPage() {
  const { status, remainingSec } = useIrrigation();
  const { canControl } = useAuth();
  const [selectedZone, setSelectedZone] = useState<number | "all">(1);
  const [preset, setPreset] = useState<number | "custom">(60);
  const [customText, setCustomText] = useState("60");
  const [confirm, setConfirm] = useState<"start" | "stop" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const active = status.active;
  const cycleBusy = active !== null || status.queue.length > 0;
  const mode = status.mode;
  const locked = !canControl || mode === "error" || !status.online;
  const durationSec = preset === "custom" ? clampSeconds(Number(customText)) : preset;
  const durationMin = durationSec / 60;
  const allZones = selectedZone === "all";
  const addToQueue = cycleBusy && !allZones;
  const startDisabled = locked || busy || (cycleBusy && allZones);
  const selectedLabel = selectedZone === "all" ? "Semua jalur" : zoneLabel(selectedZone);
  const totalDuration = durationLabel((allZones ? ZONES.length : 1) * durationSec);
  const startDescription = allZones
    ? `V01–V13 akan disiram bergantian selama ${durationLabel(durationSec)} per jalur. Perkiraan selesai: ${totalDuration}.`
    : addToQueue
      ? `Jalur ${selectedLabel} akan masuk antrean dengan durasi ${durationLabel(durationSec)}.`
      : `Jalur ${selectedLabel} akan disiram selama ${durationLabel(durationSec)}.`;
  const customAdjusted = preset === "custom" && customText.trim() !== "" && Number(customText) !== durationSec;

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
      <div className="page-title"><h2>Kontrol Penyiraman</h2><p>Pilih jalur dan durasi untuk menyiram secara manual.</p></div>

      {!canControl && <div className="banner warn">Akun Anda hanya dapat melihat. Kontrol penyiraman hanya untuk admin.</div>}
      {mode === "error" && <div className="banner bad">Sistem dalam kondisi ERROR. Periksa menu Lainnya, Sistem &amp; Error. Kontrol dinonaktifkan sampai direset di perangkat.</div>}
      {!status.online && <div className="banner bad">Controller offline. Perintah tidak dapat dikirim.</div>}
      {message && <div className="banner bad">{message}</div>}

      {cycleBusy && (
        <section className="active-watering-card">
          <div className="active-water-icon"><Icon name="droplet" size={26} /></div>
          <div className="active-water-copy"><span><i /> SIKLUS PENYIRAMAN</span><h2>{active ? zoneLabel(active.zone) : "Menunggu controller"}</h2><p>{active ? `${formatRemaining(remainingSec)} tersisa pada jalur ini` : `${status.queue.length} jalur menunggu`}</p></div>
          <Button className="stop-button" onClick={() => setConfirm("stop")} disabled={locked || busy}>Hentikan Semua</Button>
        </section>
      )}

      <div className="manual-panel">
        <section>
          <div className="step-heading"><div><h3>Pilih Jalur</h3><p>Opsi Semua Jalur menyiram V01 sampai V13 secara bergiliran.</p></div></div>
          <div className="control-zone-grid" role="group" aria-label="Jalur penyiraman">
            <Button className={allZones ? "selected" : ""} aria-pressed={allZones} onClick={() => setSelectedZone("all")}>
              Semua Jalur
            </Button>
            {ZONES.map((zone) => (
              <Button key={zone} className={selectedZone === zone ? "selected" : ""} aria-pressed={selectedZone === zone} onClick={() => setSelectedZone(zone)}>
                {zoneLabel(zone)}
              </Button>
            ))}
          </div>
        </section>
        <section>
          <div className="step-heading"><div><h3>{allZones ? "Pilih Durasi per Jalur" : "Pilih Durasi"}</h3></div></div>
          <div className="duration-grid">
            {PRESETS.map((seconds) => <Button key={seconds} className={preset === seconds ? "selected" : ""} aria-pressed={preset === seconds} onClick={() => setPreset(seconds)}>{durationLabel(seconds)}</Button>)}
            <Button className={preset === "custom" ? "selected" : ""} aria-pressed={preset === "custom"} onClick={() => setPreset("custom")}>Custom</Button>
          </div>
          {preset === "custom" && (
            <>
              <div className="custom-duration">
                <input type="number" min={MIN_WATERING_SEC} max={MAX_WATERING_SEC} step={1} value={customText} onChange={(e) => setCustomText(e.target.value)} aria-label="Durasi per jalur dalam detik" aria-describedby="durasi-catatan" />
                <span>detik (maks. 5 menit)</span>
              </div>
              <p id="durasi-catatan" className={customAdjusted ? "field-note adjusted" : "field-note"}>
                {customAdjusted
                  ? `Disesuaikan menjadi ${durationLabel(durationSec)} per jalur.`
                  : `Isi 30–300 detik. 300 detik sama dengan 5 menit.`}
              </p>
            </>
          )}
        </section>
        <div className="start-panel">
          <div className="watering-summary">
            <strong>{selectedLabel} · {durationLabel(durationSec)}{allZones ? " per jalur" : ""}</strong>
            {allZones && <span>Perkiraan selesai: {totalDuration}</span>}
          </div>
          <Button className="primary-button" disabled={startDisabled} onClick={() => setConfirm("start")}>
            <Icon name="droplet" /> {addToQueue ? "Tambah ke Antrean" : "Mulai Siram"}
          </Button>
          {cycleBusy && allZones && <p>Pilih satu jalur untuk ditambahkan ke antrean, atau tunggu penyiraman selesai untuk memulai Semua Jalur.</p>}
        </div>
      </div>

      {status.queue.length > 0 && (
        <div className="queue-list">
          <strong>Antrean ({status.queue.length})</strong>
          <ul>
            {status.queue.map((q) => (
              <li key={q.id}>
                <span>{zoneLabel(q.zone)} · {durationLabel(q.durationMin * 60)} · {q.source === "auto" ? "Otomatis" : "Manual"}</span>
              </li>
            ))}
          </ul>
          <p className="hint">Hentikan Semua menghentikan jalur aktif sekaligus membatalkan seluruh antrean.</p>
        </div>
      )}

      {confirm === "start" && (
        <ConfirmDialog tone="primary" busy={busy} title={addToQueue ? "Tambahkan ke antrean?" : "Mulai penyiraman?"} confirmLabel={addToQueue ? "Ya, Tambahkan" : "Ya, Mulai Siram"}
          message={startDescription}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void run(() => api.startWatering({ durationMin, zone: selectedZone === "all" ? undefined : selectedZone }))} />
      )}
      {confirm === "stop" && cycleBusy && (
        <ConfirmDialog tone="danger" busy={busy} title="Hentikan penyiraman?" confirmLabel="Ya, Hentikan"
          message={`Penyiraman ${active ? zoneLabel(active.zone) : "yang menunggu"} akan dihentikan dan seluruh sisa antrean dibatalkan.`}
          onCancel={() => setConfirm(null)} onConfirm={() => void run(() => api.stopWatering())} />
      )}
    </main>
  );
}
