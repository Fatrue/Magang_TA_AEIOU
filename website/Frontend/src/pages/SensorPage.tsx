import { useState } from "react";
import { api } from "../api";
import { PageHeader } from "../components/PageHeader";
import { SensorChart, type MetricKey } from "../components/SensorChart";
import { useIrrigation } from "../context/IrrigationContext";
import { useAsync } from "../hooks/useAsync";
import { formatDateTime, moistureNote, num } from "../lib/format";

const metrics: { key: MetricKey; label: string; unit: string }[] = [
  { key: "soilMoisture", label: "Kelembapan Tanah", unit: "%" },
  { key: "airTemp", label: "Suhu Udara", unit: "°C" },
  { key: "airHumidity", label: "Kelembapan Udara", unit: "%" },
];

export function SensorPage() {
  const { sensors } = useIrrigation();
  const [metric, setMetric] = useState<MetricKey>("soilMoisture");
  const series = useAsync(() => api.getSensorSeries(24), []);
  const current = metrics.find((m) => m.key === metric) ?? metrics[0];

  return (
    <main className="page">
      <PageHeader kicker="Monitoring" title="Sensor" subtitle="Nilai terbaru dan tren 24 jam terakhir." />

      <section className="card">
        <div className="metric-tabs">
          {metrics.map((m) => (
            <button key={m.key} type="button" className={metric === m.key ? "selected" : ""} aria-pressed={metric === m.key} onClick={() => setMetric(m.key)}>{m.label}</button>
          ))}
        </div>
        {series.loading && <p className="empty">Memuat grafik…</p>}
        {series.error && <p className="empty">{series.error} <button className="link-button" onClick={series.reload}>Coba lagi</button></p>}
        {series.data && <SensorChart points={series.data} metric={metric} label={current.label} unit={current.unit} />}
      </section>

      <section className="card">
        <div className="row"><span>Kelembapan tanah</span><strong>{num(sensors.soilMoisture, 1, "%")} · {moistureNote(sensors.soilMoisture)}</strong></div>
        <div className="row"><span>Suhu tanah</span><strong>{num(sensors.soilTemp, 1, "°C")}</strong></div>
        <div className="row"><span>Suhu udara</span><strong>{num(sensors.airTemp, 1, "°C")}</strong></div>
        <div className="row"><span>Kelembapan udara</span><strong>{num(sensors.airHumidity, 1, "%")}</strong></div>
        <div className="row"><span>pH tanah</span><strong>{num(sensors.ph, 1)}</strong></div>
        <div className="row"><span>EC tanah</span><strong>{num(sensors.ec, 2, " mS/cm")}</strong></div>
        <div className="row"><span>Data diterima</span><strong>{formatDateTime(sensors.receivedAt)}</strong></div>
      </section>
    </main>
  );
}