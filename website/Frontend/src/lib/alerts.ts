import type { SystemStatus } from "../types";

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
  return list;
}
