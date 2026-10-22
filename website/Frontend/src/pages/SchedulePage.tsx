import { useEffect, useState } from "react";
import { api } from "../api";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function SchedulePage() {
  const { canControl } = useAuth();
  const [first, setFirst] = useState("08:00");
  const [second, setSecond] = useState("16:00");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    api.getSchedule()
      .then((s) => {
        if (!alive || !s) return;
        if (s.first) setFirst(s.first);
        if (s.second) setSecond(s.second);
      })
      .catch((e) => {
        if (alive) setLoadError(e instanceof Error ? e.message : "Gagal memuat jadwal tersimpan.");
      });
    return () => {
      alive = false;
    };
  }, []);

  const bothValid = HHMM.test(first) && HHMM.test(second);
  const duplicate = bothValid && first === second;
  const canSave = canControl && bothValid && !duplicate && !busy;

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await api.saveSchedule({ first, second });
      setMessage({ ok: true, text: `Jadwal tersimpan: ${first} dan ${second}.` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Gagal menyimpan jadwal." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <PageHeader kicker="Pengaturan" title="Jadwal Penyiraman" />

      <section className="card">
        {loadError && <div className="banner bad">{loadError} Kolom di bawah memakai nilai bawaan.</div>}

        <div className="form-grid">
          <label className="field">
            Jadwal siram pertama
            <input
              type="time"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              disabled={!canControl}
              aria-invalid={duplicate || undefined}
              aria-describedby="jadwal-catatan"
            />
          </label>
          <label className="field">
            Jadwal siram kedua
            <input
              type="time"
              value={second}
              onChange={(e) => setSecond(e.target.value)}
              disabled={!canControl}
              aria-invalid={duplicate || undefined}
              aria-describedby="jadwal-catatan"
            />
          </label>
        </div>

        <p
          id="jadwal-catatan"
          className={duplicate ? "field-note adjusted" : "hint"}
          role={duplicate ? "alert" : undefined}
        >
          {duplicate
            ? "Jadwal siram pertama dan kedua tidak boleh sama. Ubah salah satunya."
            : !bothValid
              ? "Isi kedua kolom dengan jam yang lengkap, format 24 jam."
              : "Dua jam penyiraman harian. Keduanya harus berbeda."}
        </p>

        {message && <div className={`banner ${message.ok ? "ok" : "bad"}`}>{message.text}</div>}

        {canControl ? (
          <Button className="primary-button" disabled={!canSave} onClick={() => void save()}>
            {busy ? "Menyimpan…" : "Simpan Jadwal"}
          </Button>
        ) : (
          <p className="hint">Hanya admin yang dapat mengubah jadwal.</p>
        )}
      </section>
    </main>
  );
}