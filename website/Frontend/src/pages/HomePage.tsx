import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Icon, type IconName } from "../components/Icon";
import { useIrrigation } from "../context/IrrigationContext";
import { ZONES, zoneLabel } from "../lib/zones";
import { formatRemaining, minutesAgo, modeLabel, moistureNote, num } from "../lib/format";

export function HomePage() {
  const { status, sensors, remainingSec, sensorStale } = useIrrigation();
  const navigate = useNavigate();
  const active = status.active;
  const watering = active !== null;
  const age = minutesAgo(sensors.receivedAt);
  const heroLabel = status.mode === "error" ? "GANGGUAN SISTEM" : status.mode === "manual" ? "MODE MANUAL" : "SISTEM OTOMATIS";

  const sensorCards: { label: string; value: string; note: string; icon: IconName; tone: string }[] = [
    { label: "Kelembapan Tanah", value: num(sensors.soilMoisture, 0, "%"), note: moistureNote(sensors.soilMoisture), icon: "droplet", tone: "green" },
    { label: "Suhu Tanah", value: num(sensors.soilTemp, 1, "°C"), note: "Suhu tanah", icon: "thermometer", tone: "orange" },
    { label: "Suhu Udara", value: num(sensors.airTemp, 0, "°C"), note: "Suhu udara", icon: "sun", tone: "orange" },
    { label: "Kelembapan Udara", value: num(sensors.airHumidity, 0, "%"), note: "Kelembapan relatif", icon: "humidity", tone: "blue" },
  ];

  return (
    <main className="page">
      {status.lastError && <div className="banner bad">Gangguan: {status.lastError}</div>}
      {sensorStale && <div className="banner warn">Data sensor belum diperbarui lebih dari 15 menit.</div>}

      <div className={`hero-card ${watering ? "is-watering" : ""}`}>
        <div className="hero-topline"><span><i /> {heroLabel}</span><Icon name="shield" size={20} /></div>
        <div className="hero-main">
          <div className="water-pulse"><Icon name="droplet" size={30} /></div>
          <div>
            <p className="eyebrow">{watering ? "Sedang menyiram" : "Status saat ini"}</p>
            <h2>{active ? zoneLabel(active.zone) : "Siap"}</h2>
            <p>{active ? `${formatRemaining(remainingSec)} tersisa` : "Tidak ada penyiraman aktif"}</p>
          </div>
        </div>
        <div className="hero-footer"><Icon name="clock" size={18} /> Penyiraman terjadwal berikutnya <strong>{status.nextSchedule ?? "—"}</strong></div>
        {/* Hanya berubah saat status berubah, bukan tiap detik, supaya screen reader tidak membacakan hitung mundur terus-menerus. */}
        <p className="sr-only" aria-live="polite">{active ? `Sedang menyiram ${zoneLabel(active.zone)}` : "Tidak ada penyiraman aktif"}</p>
      </div>

      <div className="status-strip">
        <span>Mode <strong>{modeLabel(status.mode)}</strong></span>
        <span>Antrean <strong>{status.queue.length}</strong></span>
      </div>

      <section>
        <div className="section-heading"><div><span className="section-kicker">Kondisi kebun</span><h2>Ringkasan Sensor</h2></div><span className="updated">{age < 1 ? "Diperbarui baru saja" : `Diperbarui ${age} menit lalu`}</span></div>
        <div className="sensor-grid">
          {sensorCards.map((sensor) => (
            // Saat data basi, angka DIGANTI "—". Banner saja tidak cukup: operator melihat kartu, bukan banner,
            // dan angka 42% yang sebenarnya dari dua jam lalu tidak terlihat berbeda dari angka yang baru.
            <article className={`sensor-card ${sensorStale ? "is-stale" : ""}`} key={sensor.label}>
              <span className={`sensor-icon ${sensor.tone}`}><Icon name={sensor.icon} /></span>
              <div>
                <p>{sensor.label}</p>
                <strong>{sensorStale ? "—" : sensor.value}</strong>
                <small>{sensorStale ? "Data tidak segar" : sensor.note}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="section-heading"><div><span className="section-kicker">13 zona terhubung</span><h2>Status Zona</h2></div><div className="legend"><i className="active" /> Aktif <i className="waiting" /> Menunggu</div></div>
        <div className="zone-card">
          <div className="zone-grid">
            {ZONES.map((n) => {
              const st = active?.zone === n ? "active" : status.queue.some((q) => q.zone === n) ? "waiting" : "idle";
              return <div className={`zone-tile ${st}`} key={n}><span>{zoneLabel(n)}</span><small>{st === "active" ? "Aktif" : st === "waiting" ? "Menunggu" : "Siap"}</small></div>;
            })}
          </div>
          <div className="zone-note"><Icon name="shield" size={17} /> Satu zona beroperasi dalam satu waktu untuk menjaga tekanan air.</div>
        </div>
      </section>

      <Button className="primary-button home-action" onClick={() => navigate("/kontrol")}><Icon name="control" /> Kontrol Penyiraman <Icon name="chevron" size={20} /></Button>
    </main>
  );
}
