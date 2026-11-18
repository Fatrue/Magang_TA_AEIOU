# Website sistem irigasi BRMP

Frontend React/TypeScript dan backend Node.js/Express untuk pemantauan sensor serta kontrol penyiraman melalui MQTT. Database menggunakan MySQL.

## Kontrol penyiraman

- Pilih satu jalur V01–V13 atau Semua Jalur untuk penyiraman berurutan.
- Saat penyiraman berjalan, satu jalur lain dapat ditambahkan ke antrean. Semua Jalur dimulai saat tidak ada siklus aktif atau perintah yang masih menunggu.
- Preset durasi: 30 detik, 1 menit, 2 menit, dan 3 menit. Custom menerima 30–300 detik.
- Hentikan Semua menghentikan jalur aktif dan membatalkan antrean. Penghentian fisik mengikuti respons controller.
- Kontrol manual dapat diminta saat mode AUTO; tidak perlu mengganti mode di halaman Kontrol.
- Akun viewer hanya memantau. Pengiriman perintah dibatasi untuk admin dan perangkat yang online serta tidak berstatus ERROR.

Home menampilkan SISTEM ONLINE/OFFLINE dan warna hijau/merah sesuai status koneksi. Data sensor yang belum diperbarui diberi label Menunggu data terbaru. Halaman Jadwal dan informasi Jadwal Berikutnya sudah dihilangkan dari tampilan; kontrak/API jadwal tetap tersedia untuk kompatibilitas perangkat.

## Menjalankan lokal

Gunakan Node.js minimal 24 sesuai package.json. Jalankan layanan MySQL dan broker MQTT yang dikonfigurasi pada backend.

### Backend

1. Salin Backend/.env.example menjadi Backend/.env, lalu isi koneksi database, JWT_SECRET, dan kredensial MQTT bila digunakan.
2. Untuk database baru, gunakan Backend/sql/01_schema.sql lalu 02_seed.sql. Jika database sudah ada, pertahankan data dan skemanya; jangan menjalankan ulang pembuatan tabel.
3. Dari folder Backend:

```powershell
npm.cmd ci
npm.cmd run dev
```

Contoh konfigurasi menggunakan port 3001. Pemeriksaan server: http://127.0.0.1:3001/api/health.

Akun aplikasi dibuat melalui skrip buat-user dengan username, kata sandi, nama, dan peran milik pengguna. Contoh bentuk perintah:

```text
npm run buat-user -- <username> <password> "<nama>" <admin|viewer>
```

### Frontend

1. Salin Frontend/.env.example menjadi Frontend/.env.local. Nilai VITE_API_MODE=http menghubungkan aplikasi ke backend; mock menjalankan simulasi di memori.
2. Dari folder Frontend:

```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5188 --strictPort
```

Buka http://127.0.0.1:5188/. Proxy /api dan /socket.io mengarah ke backend http://127.0.0.1:3001. Jika alamat/port diubah, sesuaikan CORS_ORIGIN dan variabel proses VITE_BACKEND_URL.

## Durasi dan database

POST /api/watering menerima durationMin serta zone opsional:

```json
{ "zone": 12, "durationMin": 0.5 }
```

Permintaan tersebut memilih V12 selama 30 detik. Tanpa zone, seluruh V01–V13 masuk antrean. Endpoint kontrol memerlukan token admin.

Durasi perintah baru disimpan sebagai detik bulat pada control_commands.payload.durationSec. Data lama tetap dibaca melalui duration_min. Karena payload sudah tersedia pada skema awal, migrasi 03_manual_duration.sql bersifat opsional; migrasi tersebut hanya memperluas kolom duration_min menjadi DECIMAL(10,6).

## Kontrak perangkat

Antrean backend menunggu laporan valve aktif dan penutupan dari controller. Firmware perlu melaporkan system/active_valve dengan nomor jalur aktif dan nilai 0 setelah valve menutup. Durasi pada topik control/command/duration menggunakan menit dan dapat berupa pecahan, misalnya 0.5 untuk 30 detik. Firmware harus membacanya sebagai angka pecahan.

Pembaruan folder website tidak mengubah firmware. Keberhasilan pengujian aplikasi tidak menggantikan pengujian katup fisik. Sistem dirancang untuk 13 jalur; pemasangan dua solenoid hanya mengalirkan air pada dua jalur yang terpasang.

## Validasi

Dari folder Backend:

```powershell
npm.cmd run build
node --experimental-test-module-mocks --test tests/manual-duration.test.mjs tests/mode-change.test.mjs tests/watering-target.test.mjs
```

Dari folder Frontend:

```powershell
npx.cmd tsc --noEmit
npm.cmd run build
```
