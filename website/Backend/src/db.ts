import mysql from "mysql2/promise";
import { env } from "./env.js";

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  // Simpan dan baca semuanya dalam UTC. Tanpa baris ini, waktu akan
  // bergeser mengikuti zona waktu komputer dan grafik tren ikut melenceng.
  timezone: "Z",

  // Tanpa baris ini, kolom DECIMAL dibaca sebagai string, sehingga JSON
  // berisi "42.50" dan bukan 42.5. Frontend mengharapkan angka.
  decimalNumbers: true,
});

export async function pingDb(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}