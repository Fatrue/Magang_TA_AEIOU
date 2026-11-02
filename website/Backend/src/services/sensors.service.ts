import type { RowDataPacket } from "mysql2";
import { pool } from "../db.js";
import type { SensorPoint, SensorReading } from "../contract.js";
import { num, toIso } from "../lib/time.js";

export async function getLatestSensors(): Promise<SensorReading> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT soil_moisture, soil_temp, air_temp, air_humidity, ph, ec, received_at
       FROM sensor_readings
      ORDER BY received_at DESC
      LIMIT 1`,
  );
  const r = rows[0];
  if (!r) {
    // Belum ada data sama sekali. Kirim semuanya null, jangan nol —
    // frontend menampilkan null sebagai tanda pisah dan nol sebagai angka.
    return {
      soilMoisture: null, soilTemp: null, airTemp: null,
      airHumidity: null, ph: null, ec: null,
      receivedAt: new Date(0).toISOString(),
    };
  }
  return {
    soilMoisture: num(r.soil_moisture),
    soilTemp: num(r.soil_temp),
    airTemp: num(r.air_temp),
    airHumidity: num(r.air_humidity),
    ph: num(r.ph),
    ec: num(r.ec),
    receivedAt: toIso(r.received_at as Date) ?? new Date(0).toISOString(),
  };
}

/**
 * Dikelompokkan per 10 menit. Satu hari berisi sekitar 288 pembacaan per
 * sensor; tanpa pengelompokan, permintaan 7 hari mengirim ribuan titik dan
 * grafik menjadi berat tanpa menambah informasi apa pun.
 */
export async function getSensorSeries(hours: number): Promise<SensorPoint[]> {
  const safeHours = Math.min(168, Math.max(1, Math.round(hours)));
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT MIN(received_at)   AS at,
            AVG(soil_moisture) AS soil_moisture,
            AVG(air_temp)      AS air_temp,
            AVG(air_humidity)  AS air_humidity
       FROM sensor_readings
      WHERE received_at >= NOW() - INTERVAL ? HOUR
      GROUP BY FLOOR(UNIX_TIMESTAMP(received_at) / 600)
      ORDER BY at`,
    [safeHours],
  );
  return rows.map((r) => ({
    at: toIso(r.at as Date) ?? new Date(0).toISOString(),
    soilMoisture: num(r.soil_moisture),
    airTemp: num(r.air_temp),
    airHumidity: num(r.air_humidity),
  }));
}
