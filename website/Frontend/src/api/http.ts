import { io, type Socket } from "socket.io-client";
import type { IrrigationApi } from "../types";
import { TOKEN_KEY } from "../lib/session";

// Kosong = same-origin (dev: diteruskan oleh proxy di vite.config.ts).
const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (res.status === 401 && path !== "/api/auth/login") {
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new Event("irigasi:unauthorized")); // didengarkan AuthContext -> keluar
    throw new Error("Sesi berakhir. Silakan masuk lagi.");
  }
  if (!res.ok) {
    let msg = `Permintaan gagal (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) msg = body.message;
    } catch {
      /* abaikan: body bukan JSON */
    }
    throw new Error(msg);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

let socket: Socket | null = null;
function getSocket(): Socket {
  if (!socket) {
    const opts = { auth: (cb: (data: object) => void) => cb({ token: localStorage.getItem(TOKEN_KEY) }), transports: ["websocket"] };
    socket = base ? io(base, opts) : io(opts);
  }
  return socket;
}

export const httpApi: IrrigationApi = {
  login: (username, password) => req("/api/auth/login", { method: "POST", ...json({ username, password }) }),
  getStatus: () => req("/api/status"),
  getSensors: () => req("/api/sensors/latest"),
  getSensorSeries: (hours) => req(`/api/sensors/series?hours=${hours}`),
  getHistory: (limit = 20) => req(`/api/history?limit=${limit}`),
  getErrors: (limit = 50) => req(`/api/errors?limit=${limit}`),
  getSchedule: () => req("/api/schedule"),
  saveSchedule: (s) => req("/api/schedule", { method: "PUT", ...json(s) }),
  startWatering: (cmd) => req("/api/watering", { method: "POST", ...json(cmd) }),
  stopWatering: () => req("/api/watering/stop", { method: "POST" }),
  cancelQueued: (id) => req(`/api/watering/queue/${encodeURIComponent(id)}`, { method: "DELETE" }),
  setMode: (mode) => req("/api/mode", { method: "PUT", ...json({ mode }) }),
  subscribe(fn) {
    const s = getSocket();
    s.on("status", fn);
    s.on("sensors", fn);
    s.on("connect", fn);
    return () => {
      s.off("status", fn);
      s.off("sensors", fn);
      s.off("connect", fn);
    };
  },
};