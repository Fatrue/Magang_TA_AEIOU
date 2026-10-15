import type { SystemStatus } from "../types";
import { batteryState } from "./format";

export interface AppAlert {
  id: string;
  title: string;
  detail: string;
  level: "warn" | "bad";
}

export function buildAlerts(status: SystemStatus, sensorStale: boolean): AppAlert[] {
  const list: AppAlert[] = [];
  if (!status.online) list.push({ id: "offline", level: "bad", title: "Controller offline", detail: "Main controller tidak terhubung ke server." });
  if (status.lastError) list.push({ id: "error", level: "bad", title: "Gangguan sistem", detail: status.lastError });
  if (sensorStale) list.push({ id: "stale", level: "warn", title: "Data sensor tidak terbaru", detail: "Belum ada data sensor baru lebih dari 15 menit." });
  const battery = batteryState(status.batteryVolt);
  if (battery.status === "low") list.push({ id: "battery", level: "warn", title: "Baterai rendah", detail: "Tegangan baterai di bawah 12.5 V." });
  if (battery.status === "invalid") list.push({ id: "battery-invalid", level: "bad", title: "Tegangan baterai tidak wajar", detail: `Terbaca ${status.batteryVolt} V, di luar rentang LiFePO4 10.0-14.6 V. Periksa rangkaian pembaca tegangan atau firmware.` });
  return list;
}