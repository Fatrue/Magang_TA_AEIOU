import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatClock } from "../lib/format";
import type { SensorPoint } from "../types";

export type MetricKey = "soilMoisture" | "airTemp" | "airHumidity";

export function SensorChart({ points, metric, label, unit }: { points: SensorPoint[]; metric: MetricKey; label: string; unit: string }) {
  const data = points.map((p) => ({ time: formatClock(p.at), value: p[metric] }));
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4ebe8" />
          <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={40} />
          <YAxis tick={{ fontSize: 11 }} unit={unit} domain={["auto", "auto"]} />
          <Tooltip />
          <Line type="monotone" dataKey="value" name={label} stroke="#1f7153" strokeWidth={2} dot={false} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}