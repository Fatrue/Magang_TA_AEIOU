import type { NextFunction, Request, Response } from "express";
import { forbidden, unauthorized } from "../lib/HttpError.js";
import { verifyToken, type TokenPayload } from "./token.js";
import type { RowDataPacket } from "mysql2";
import { pool } from "../db.js";
import type { UserRole } from "../contract.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: TokenPayload;
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(unauthorized());

  let payload: TokenPayload;
  try {
    payload = verifyToken(header.slice(7));
  } catch {
    return next(unauthorized());
  }

  // Tanda tangan yang sah belum berarti penggunanya masih ada. Tanpa
  // pemeriksaan ini, token lama tetap lolos: permintaan baca berhasil,
  // tetapi penyisipan yang menunjuk ke `users` ditolak kunci asing dan
  // muncul sebagai 500 yang membingungkan.
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, name, role FROM users WHERE id = ? AND is_active = 1`,
    [payload.sub],
  );
  const user = rows[0];
  if (!user) return next(unauthorized("Akun tidak ditemukan atau dinonaktifkan. Silakan masuk lagi."));

  req.user = { sub: Number(user.id), name: String(user.name), role: user.role as UserRole };
  next();
}

// Frontend sudah mematikan tombol untuk peran viewer, tetapi siapa pun yang
// memegang token bisa memanggil endpoint langsung. Pemeriksaan di sini yang
// sebenarnya mengamankan, bukan yang di layar.
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== "admin") {
    return next(forbidden("Hanya admin yang dapat melakukan tindakan ini."));
  }
  next();
}
