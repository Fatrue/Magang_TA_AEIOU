import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api";
import { buildAlerts, type AppAlert } from "../lib/alerts";
import { Button } from "../components/Button";
import type { SensorReading, SystemStatus } from "../types";

interface IrrigationValue {
  status: SystemStatus;
  sensors: SensorReading;
  error: string | null; // terisi jika pengambilan data terakhir gagal (data di layar bisa usang)
  remainingSec: number; // sisa waktu penyiraman aktif, dihitung tiap detik
  sensorStale: boolean;
  alerts: AppAlert[];
  refresh: () => Promise<void>;
}

const IrrigationContext = createContext<IrrigationValue | null>(null);

export function IrrigationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [sensors, setSensors] = useState<SensorReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([api.getStatus(), api.getSensors()]);
      setStatus(s);
      setSensors(r);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tidak dapat terhubung ke server");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const off = api.subscribe(() => void refresh());
    const poll = setInterval(() => void refresh(), 30_000); // cadangan jika push real-time putus
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      off();
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [refresh]);

  // Sensor mengirim tiap 5 menit (PRD 12.1). Ambang 15 menit agar 1 paket LoRa yang telat tidak memicu alarm palsu.
  const sensorStale = sensors ? now - Date.parse(sensors.receivedAt) > 15 * 60_000 : false;

  const remainingSec = status?.active
    ? Math.max(0, status.active.durationSec - Math.floor((now - Date.parse(status.active.startedAt)) / 1000))
    : 0;

  const alerts = useMemo(() => (status ? buildAlerts(status, sensorStale) : []), [status, sensorStale]);

  if (!status || !sensors) {
    return (
      <div className="login-wrap">
        <div className="empty">
          <p>{error ?? "Memuat data…"}</p>
          {error && <Button className="secondary-button" onClick={() => void refresh()}>Coba lagi</Button>}
        </div>
      </div>
    );
  }

  return (
    <IrrigationContext.Provider value={{ status, sensors, error, remainingSec, sensorStale, alerts, refresh }}>
      {children}
    </IrrigationContext.Provider>
  );
}

export function useIrrigation() {
  const ctx = useContext(IrrigationContext);
  if (!ctx) throw new Error("useIrrigation harus dipakai di dalam IrrigationProvider");
  return ctx;
}