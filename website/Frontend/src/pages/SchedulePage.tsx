import { useEffect, useState } from "react";
import { api } from "../api";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function SchedulePage() {
  const { canControl } = useAuth();
  const schedule = useAsync(() => api.getSchedule(), []);
  const [morning, setMorning] = useState("08:00");
  const [evening, setEvening] = useState("16:00");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (schedule.data) {
      setMorning(schedule.data.morning);
      setEvening(schedule.data.evening);
    }
  }, [schedule.data]);

  const save = async () => {
    if (!HHMM.test(morning) || !HHMM.test(evening)) return setMessage({ ok: false, text: "Format jam harus HH:MM." });
    if (morning === evening) return setMessage({ ok: false, text: "Jadwal pagi dan sore tidak boleh sama." });
    setBusy(true);
    setMessage(null);
    try {
      await api.saveSchedule({ morning, evening });
      setMessage({ ok: true, text: "Jadwal tersimpan." });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Gagal menyimpan" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <PageHeader kicker="Pengaturan" title="Jadwal" subtitle="Jam sistem membaca sensor dan menjalankan evaluasi fuzzy." />
      {schedule.loading && <p className="empty">Memuat jadwal…</p>}
      {schedule.error && <div className="banner bad">{schedule.error}</div>}
      {schedule.data && (
        <section className="card">
          <div className="form-grid">
            <label className="field">Jadwal pagi
              <input type="time" value={morning} onChange={(e) => setMorning(e.target.value)} disabled={!canControl} />
            </label>
            <label className="field">Jadwal sore
              <input type="time" value={evening} onChange={(e) => setEvening(e.target.value)} disabled={!canControl} />
            </label>
          </div>
          <p className="hint">Jadwal hanya memicu evaluasi. Keputusan menyiram atau tidak tetap ditentukan logika fuzzy (PRD 9.4).</p>
          {message && <div className={`banner ${message.ok ? "ok" : "bad"}`}>{message.text}</div>}
          {canControl ? <Button className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? "Menyimpan…" : "Simpan Jadwal"}</Button> : <p className="hint">Hanya admin yang dapat mengubah jadwal.</p>}
        </section>
      )}
    </main>
  );
}