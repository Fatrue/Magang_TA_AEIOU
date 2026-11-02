import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),

  JWT_SECRET: z.string().min(32, "minimal 32 karakter, buat dengan crypto.randomBytes"),
  JWT_EXPIRES_IN: z.string().default("12h"),

  MQTT_URL: z.string().min(1),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  SENSOR_WRITE_MS: z.coerce.number().int().positive().default(60_000),
  OFFLINE_AFTER_MS: z.coerce.number().int().positive().default(120_000),
});

const parsed = schema.safeParse(process.env);

// Server yang menyala dengan JWT_SECRET kosong lebih berbahaya daripada
// server yang menolak menyala. Jadi di sini kita berhenti, bukan melanjutkan.
if (!parsed.success) {
  console.error("Konfigurasi .env tidak lengkap atau tidak sah:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;