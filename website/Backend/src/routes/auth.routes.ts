import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { pool } from "../db.js";
import { verifyPassword } from "../auth/password.js";
import { signToken } from "../auth/token.js";
import { badRequest, unauthorized } from "../lib/HttpError.js";
import type { LoginResult, UserRole } from "../contract.js";

export const authRouter = Router();

// Tanpa pembatas, kata sandi enam huruf bisa ditebak habis dalam hitungan jam.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit." },
});

const bodySchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(200),
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Username dan password wajib diisi.");
  const { username, password } = parsed.data;

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, username, password_hash, name, role
       FROM users WHERE username = ? AND is_active = 1`,
    [username],
  );
  const user = rows[0];

  // Pesan yang sama untuk username salah dan password salah. Membedakannya
  // memberi tahu penyerang username mana yang benar-benar ada.
  const ok = user ? await verifyPassword(String(user.password_hash), password) : false;
  if (!user || !ok) throw unauthorized("Username atau password salah");

  const result: LoginResult = {
    token: signToken({ sub: Number(user.id), name: String(user.name), role: user.role as UserRole }),
    user: { name: String(user.name), role: user.role as UserRole },
  };
  res.json(result);
});
