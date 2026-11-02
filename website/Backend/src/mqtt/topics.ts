// Seluruh nama topik berkumpul di sini. MQTT tidak pernah mengeluh kalau
// Anda berlangganan ke topik yang salah ketik — ia hanya diam selamanya.
// Satu tempat berarti satu tempat untuk memperbaikinya.

const ROOT = "irigasi/brmp";

export const IN = {
  airTemp: `${ROOT}/sensor/dht22/temperature`,
  airHumidity: `${ROOT}/sensor/dht22/humidity`,
  soilMoisture: `${ROOT}/sensor/soil/moisture`,
  soilTemp: `${ROOT}/sensor/soil/temperature`,
  ph: `${ROOT}/sensor/soil/ph`,
  ec: `${ROOT}/sensor/soil/ec`,

  status: `${ROOT}/system/status`,
  activeValve: `${ROOT}/system/active_valve`,
  activeDuration: `${ROOT}/system/active_duration`,
  activeSource: `${ROOT}/system/active_source`,
  queue: `${ROOT}/system/queue`,
  nextSchedule: `${ROOT}/system/next_schedule`,
  uptime: `${ROOT}/system/uptime`,
  wifiRssi: `${ROOT}/system/wifi_rssi`,
  lastError: `${ROOT}/system/last_error`,
  schedule: `${ROOT}/system/schedule`,
  lwt: `${ROOT}/system/connection`,
} as const;

export const OUT = {
  valve: `${ROOT}/control/command/valve`,
  duration: `${ROOT}/control/command/duration`,
  stop: `${ROOT}/control/command/stop`,
  mode: `${ROOT}/control/command/mode`,
  cancelQueue: `${ROOT}/control/queue/cancel`,
  setSchedule: `${ROOT}/control/schedule/set`,
} as const;

export const SUBSCRIPTIONS = Object.values(IN);
