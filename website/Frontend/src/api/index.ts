import type { IrrigationApi } from "../types";
import { mockApi } from "./mock";
import { httpApi } from "./http";

// Default: data mock. Untuk memakai backend asli, buat file .env.local berisi: VITE_API_MODE=http
export const isMock = import.meta.env.VITE_API_MODE !== "http";
export const api: IrrigationApi = isMock ? mockApi : httpApi;