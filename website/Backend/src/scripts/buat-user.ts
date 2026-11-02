/**
 * Membuat atau memperbarui satu akun.
 *   npm run buat-user -- admin admin123 "Admin" admin
 *   npm run buat-user -- viewer viewer123 "Pengamat" viewer
 *
 * Akun dibuat lewat skrip, bukan lewat SQL, karena password_hash harus
 * dihasilkan Argon2id — tidak ada cara menuliskannya langsung di file .sql.
 */
import { pool } from "../db.js";
import { hashPassword } from "../auth/password.js";

const [username, password, name, role] = process.argv.slice(2);

if (!username || !password || !name || (role !== "admin" && role !== "viewer")) {
  console.error('Pakai: npm run buat-user -- <username> <password> "<nama>" <admin|viewer>');
  process.exit(1);
}

if (password.length < 8) {
  console.error("Kata sandi minimal 8 karakter.");
  process.exit(1);
}

const hash = await hashPassword(password);

await pool.execute(
  `INSERT INTO users (username, password_hash, name, role)
   VALUES (?, ?, ?, ?)
   ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash),
                           name = VALUES(name),
                           role = VALUES(role),
                           is_active = 1`,
  [username, hash, name, role],
);

console.log(`Akun "${username}" (${role}) siap.`);
await pool.end();
