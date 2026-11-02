import { hash, verify } from "@node-rs/argon2";

// Parameter mengikuti anjuran OWASP untuk Argon2id.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain, OPTIONS);
  } catch {
    // Hash rusak atau format tidak dikenal: perlakukan sebagai gagal,
    // jangan sampai melempar error dan membocorkan bentuk penyimpanan.
    return false;
  }
}