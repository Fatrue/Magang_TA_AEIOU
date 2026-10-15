import { useEffect, useState } from "react";
import { api } from "../api";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { MAX_WATERING_MIN } from "../lib/zones";

// Referensi baca-saja dari PRD 9.3. Pengubahan fuzzy dikerjakan di fase lanjutan (butuh backend + firmware).
const fuzzyInputs = [
  { name: "Kelembapan tanah (0–100%)", sets: "Dry 0–30 · Optimal 20–70 · Wet 60–100" },
  { name: "Suhu udara (10–50°C)", sets: "Cold 10–20 · Moderate 15–30 · Hot 25–50" },
  { name: "Kelembapan udara (20–100%RH)", sets: "Low 20–50 · Moderate 40–70 · High 60–100" },
];

export function SettingsPage() {
  const { canControl } = useAuth();
  const calibration = useAsync(() => api.getCalibration(), []);
  const [tempOffset, setTempOffset] = useState("0");
  const [humidityOffset, setHumidityOffset] = useState("0");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (calibration.data) {
      setTempOffset(String(calibration.data.tempOffset));
      setHumidityOffset(String(calibration.data.humidityOffset));
    }
  }, [calibration.data]);

  const save = async () => {
    const t = Number(tempOffset);
    const h = Number(humidityOffset);
    if (!Number.isFinite(t) || !Number.isFinite(h) || Math.abs(t) > 10 || Math.abs(h) > 20) {
      return setMessage({ ok: false, text: "Offset tidak valid (suhu maks ±10, kelembapan maks ±20)." });
    }
    setBusy(true);
    setMessage(null);
    try {
      await api.saveCalibration({ tempOffset: t, humidityOffset: h });
      setMessage({ ok: true, text: "Kalibrasi tersimpan." });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Gagal menyimpan" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <PageHeader kicker="Konfigurasi" title="Pengaturan" subtitle="Kalibrasi sensor dan parameter sistem." />

      <section className="card">
        <h3 className="card-title">Kalibrasi DHT22</h3>
        <p className="hint">Nilai sebenarnya = pembacaan sensor + offset (PRD 15.2). Isi offset setelah dibandingkan dengan termometer/higrometer acuan.</p>
        {calibration.loading && <p className="empty">Memuat…</p>}
        {calibration.error && <div className="banner bad">{calibration.error}</div>}
        {calibration.data && (
          <>
            <div className="form-grid">
              <label className="field">Offset suhu (°C)
                <input type="number" step="0.1" value={tempOffset} onChange={(e) => setTempOffset(e.target.value)} disabled={!canControl} />
              </label>
              <label className="field">Offset kelembapan (%RH)
                <input type="number" step="0.1" value={humidityOffset} onChange={(e) => setHumidityOffset(e.target.value)} disabled={!canControl} />
              </label>
            </div>
            {message && <div className={`banner ${message.ok ? "ok" : "bad"}`}>{message.text}</div>}
            {canControl ? <Button className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? "Menyimpan…" : "Simpan Kalibrasi"}</Button> : <p className="hint">Hanya admin yang dapat mengubah kalibrasi.</p>}
          </>
        )}
      </section>

      <section className="card">
        <h3 className="card-title">Batas keselamatan</h3>
        <div className="row"><span>Durasi maksimum per zona</span><strong>{MAX_WATERING_MIN} menit</strong></div>
        <div className="row"><span>Valve aktif bersamaan</span><strong>1</strong></div>
        <p className="hint">Batas ini ditegakkan di firmware (PRD 11.2). Tampilan ini hanya informasi.</p>
      </section>

      <section className="card">
        <h3 className="card-title">Logika fuzzy (baca saja)</h3>
        {fuzzyInputs.map((f) => (
          <div className="row" key={f.name}><span>{f.name}</span><strong>{f.sets}</strong></div>
        ))}
        <p className="hint">Rule contoh dan fungsi keanggotaan masih akan dikalibrasi di lapangan (PRD 9.3).</p>
      </section>
    </main>
  );
}