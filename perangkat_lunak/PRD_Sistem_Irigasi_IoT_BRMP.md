# Product Requirements Document (PRD)

## Sistem Irigasi Taman Otomatis Berbasis IoT dan Energi Surya — Taman BRMP

|                   |                                                          |
| ----------------- | -------------------------------------------------------- |
| **Status**        | Draft v1.0 — untuk dasar proposal/TA Kelompok            |
| **Tanggal**       | 14 September 2026                                        |
| **Jenis dokumen** | Product Requirements Document (PRD)                      |
| **Terkait**       | _Ringkasan Lengkap Proyek Irigasi BRMP_ (dokumen sumber) |

---

## 1. Ringkasan Eksekutif

Proyek ini membangun sistem irigasi taman otomatis berbasis IoT untuk taman depan BRMP, menggantikan proses penyiraman manual yang saat ini masih mengharuskan operator datang ke lokasi untuk membuka/menutup valve satu per satu. Sistem baru akan membaca kondisi lingkungan (kelembapan tanah, suhu udara, kelembapan udara), menentukan kebutuhan air memakai logika fuzzy Mamdani, dan mengendalikan 13 jalur irigasi secara berurutan (sequential) karena tekanan air yang tersedia rendah. Sistem dapat dipantau dan dikendalikan dari web dashboard maupun panel LCD lokal, dengan LoRa sebagai jalur komunikasi sensor outdoor dan energi surya sebagai catu daya perangkat kontrol/sensor.

Proyek diposisikan sebagai **sistem manajemen irigasi multi-zona**, bukan sekadar kontrol pompa — nilainya terletak pada integrasi sequential control, fuzzy decision making, komunikasi wireless jarak jauh hemat daya, dashboard IoT, energi mandiri, dan mekanisme fail-safe.

---

## 2. Latar Belakang & Masalah

- Penyiraman taman BRMP masih **manual**: operator wajib hadir di lokasi untuk membuka/menutup valve.
- Taman terbagi menjadi **13 jalur irigasi**, masing-masing dengan satu solenoid valve dan sejumlah petak tanaman serta jumlah titik sprinkler yang berbeda-beda per jalur (layout dan jumlah aktual — lihat §19).
- **Tekanan air rendah** sehingga seluruh jalur tidak dapat dibuka bersamaan — dibutuhkan strategi buka valve bergiliran.
- Kebutuhan air setiap saat dipengaruhi banyak faktor (kelembapan tanah, suhu, kelembapan udara), bukan satu parameter tunggal — keputusan berbasis threshold sederhana dianggap tidak cukup representatif.
- Sensor berada di area outdoor sehingga komunikasi dan catu daya harus dirancang tahan kondisi lapangan.
- Sistem harus tetap aman (valve tidak macet menyala) meskipun internet atau sensor bermasalah.

---

## 3. Tujuan Produk

1. Melakukan penyiraman **otomatis** tanpa kehadiran operator di lokasi.
2. Mengendalikan **13 jalur irigasi** secara sequential menggunakan solenoid valve.
3. Membaca kelembapan tanah, suhu udara, dan kelembapan udara sebagai basis keputusan.
4. Menentukan kebutuhan penyiraman menggunakan **logika fuzzy Mamdani** (defuzzifikasi Centroid).
5. Menyediakan **kontrol & monitoring jarak jauh** via web dashboard.
6. Menyediakan **kontrol & monitoring lokal** via panel LCD I2C 20×4.
7. Menggunakan **LoRa** sebagai komunikasi sensor node ↔ main controller.
8. Menerapkan **energi surya** untuk perangkat kontrol dan sensor node.
9. Menjamin **interlock** (hanya satu valve aktif dalam satu waktu) dan **fail-safe** saat kondisi abnormal.

### Kriteria sukses (indikatif, dikalibrasi saat pengujian lapangan)

- Sistem mampu menjalankan siklus penyiraman 13 jalur penuh tanpa dua valve aktif bersamaan.
- Valve otomatis OFF jika melampaui _maximum watering time_ atau saat sensor/koneksi timeout.
- Data sensor terkirim ke main controller dengan packet loss LoRa dalam batas yang dapat diterima (target diuji, lihat §8).
- Dashboard menampilkan status real-time (≤ beberapa detik delay) dan histori penyiraman tersimpan di database.
- Sistem tetap dapat menjalankan kontrol inti dari ESP32 walau koneksi internet terputus.

---

## 4. Ruang Lingkup

### 4.1 Termasuk dalam ruang lingkup

- Main control panel + sensor node berbasis ESP32 dengan LoRa terintegrasi.
- Logika fuzzy Mamdani untuk penentuan kebutuhan air (input: soil moisture, suhu, kelembapan udara).
- Kontrol sequential 13 solenoid valve melalui 74HC595 → driver → relay 16 channel.
- Tiga mode operasi: Manual, Schedule (08:00 & 16:00), Automatic (fuzzy).
- Sistem antrean (queue) permintaan penyiraman.
- Panel LCD I2C 20×4 lokal.
- Web dashboard (React.js + Node.js/Express + MySQL + MQTT + WebSocket).
- Catu daya surya untuk main controller dan/atau sensor node (skema di §11).
- Mekanisme interlock, watchdog, fail-safe, dan proteksi elektrik dasar.

### 4.2 Di luar ruang lingkup (untuk versi ini)

- Sensor hujan dan LDR (**tidak digunakan** pada rancangan terbaru).
- Flow sensor / feedback posisi valve (diakui sebagai keterbatasan, lihat §13 — potensi pengembangan lanjutan).
- **Kendali motor pompa oleh sistem IoT — dikonfirmasi di luar lingkup.** Pompa existing sudah memiliki _automatic pressure controller/pressure switch_, sehingga sistem IoT tidak perlu dan tidak akan mengendalikan pompa secara langsung (lihat §9).
- Multi-titik sensor tanah per jalur (baseline memakai representative sampling point).

---

## 5. Pengguna & Stakeholder

| Peran                    | Kebutuhan utama                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Operator/petugas taman   | Monitoring cepat via LCD lokal, override manual saat diperlukan                                                           |
| Pengelola/administrator  | Kontrol & laporan histori via web dashboard, penjadwalan                                                                  |
| Tim TA (pengembang)      | Arsitektur jelas agar dapat dibagi per subsistem (sensor & komunikasi, fuzzy & kontrol, power electronics, web/dashboard) |
| Dosen pembimbing/penguji | Dokumentasi yang jelas, verifikasi keselamatan (interlock, fail-safe)                                                     |

---

## 6. Arsitektur Sistem

```
Internet → Wi-Fi → Web Server (Node.js + MySQL) → MQTT/HTTP/WebSocket
                                    │
                                    ▼
                     Main Controller (ESP32 + LoRa)
                    ├── LCD I2C 20×4 (lokal)
                    ├── 74HC595 ×2 (16 output)
                    ├── Driver (ULN2803) → Relay 16ch → 13 Solenoid Valve
                    └── LoRa ⇄ Sensor Node
                                    ▲
                                    │ LoRa
                     Sensor Node (ESP32 + LoRa)
                    ├── DHT22 (suhu & kelembapan udara)
                    └── Soil Moisture RS485 (via MAX485)
```

Alur kerja singkat: sensor membaca kondisi → data dikirim via LoRa → main controller memproses (fuzzy/schedule/manual) → valve diaktifkan berurutan sesuai antrean → status ditampilkan di LCD dan web dashboard.

---

## 7. Requirement Hardware & Pin Mapping (Update Terbaru)

### 7.1 Keputusan platform controller

Setelah evaluasi terhadap beberapa opsi (LILYGO TTGO LoRa32 V2.1, ESP32 DevKit + modul LoRa terpisah, Heltec WiFi LoRa32 V3), **platform yang direkomendasikan untuk kedua unit (main controller dan sensor node) adalah Heltec WiFi LoRa32 V3** (ESP32‑S3 + chip radio SX1262), dengan pertimbangan:

- Tidak memiliki slot TF/SD card yang menyita GPIO seperti pada TTGO T3_V1.6.
- Chip radio SX1262 lebih sensitif dan lebih hemat daya dibanding SX1276/1278 pada TTGO.
- UART pada ESP32‑S3 dapat dipetakan bebas ke GPIO mana pun (GPIO matrix), sehingga RS485 dapat memakai **hardware UART**, bukan software serial.
- Satu jenis board untuk kedua unit → firmware base sama, dokumentasi TA lebih konsisten.

> Keputusan ini menggantikan opsi awal di dokumen sumber (LILYGO TTGO LoRa32 V2.1 untuk kedua unit, atau kombinasi ESP32 DevKit + RA‑02). Alasan detail perbandingan tersedia di riwayat diskusi desain.

### 7.2 Pin bawaan Heltec WiFi LoRa32 V3 (tidak dapat diubah)

| Fungsi                                                    | GPIO             |
| --------------------------------------------------------- | ---------------- |
| LoRa NSS/CS                                               | 8                |
| LoRa SCK                                                  | 9                |
| LoRa MOSI                                                 | 10               |
| LoRa MISO                                                 | 11               |
| LoRa RST                                                  | 12               |
| LoRa BUSY                                                 | 13               |
| LoRa DIO1                                                 | 14               |
| OLED SDA                                                  | 17               |
| OLED SCL                                                  | 18               |
| OLED RST                                                  | 21               |
| Vext (power switch periferal eksternal)                   | 36               |
| Tombol BOOT                                               | 0                |
| USB-Serial (CP2102 — jangan dipakai untuk periferal lain) | 43 (TX), 44 (RX) |

### 7.3 Pin mapping — Main Control Panel

| Fungsi                           | GPIO               | Catatan                                                  |
| -------------------------------- | ------------------ | -------------------------------------------------------- |
| Data (DS) 74HC595                | 1                  |                                                          |
| Clock (SHCP) 74HC595             | 2                  |                                                          |
| Latch (STCP) 74HC595             | 3                  |                                                          |
| MR — fail-safe reset (aktif LOW) | 4                  | Default LOW saat boot = seluruh valve OFF (kondisi aman) |
| LCD I2C 20×4                     | 17 (SDA), 18 (SCL) | Satu bus dengan OLED bawaan, beda alamat I2C             |

### 7.4 Pin mapping — Sensor Node

| Fungsi                         | GPIO | Catatan                   |
| ------------------------------ | ---- | ------------------------- |
| DHT22 data                     | 1    |                           |
| MAX485 DE/RE                   | 2    | DE & RE digabung satu pin |
| MAX485 RO → RX (hardware UART) | 3    |                           |
| MAX485 DI ← TX (hardware UART) | 4    |                           |

**Catatan wajib:** GPIO45 dan GPIO46 adalah strapping pin pada ESP32-S3 (mempengaruhi tegangan VDD_SPI dan verbosity boot log) — hindari untuk output kritikal seperti valve/relay. Pin mapping final tetap wajib diverifikasi fisik (blink test per pin) terhadap revisi board yang benar-benar dibeli, sesuai §13 dokumen sumber.

### 7.5 Komponen daya & aktuasi

| Komponen                        | Fungsi                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 74HC595 × 2 (dirangkai cascade) | Memperbanyak 3 jalur kontrol menjadi 16 output                                                                 |
| Driver ULN2803A × 2             | Menjembatani output 74HC595 (logic 3.3V) ke beban relay — 74HC595 tidak boleh langsung menggerakkan coil relay |
| Relay 16 channel 12 V           | Channel 1–13 = Valve 1–13, channel sisa = cadangan/fungsi tambahan                                             |
| Solenoid valve × 13             | Aktuator tiap jalur irigasi                                                                                    |
| LCD I2C 20×4                    | Antarmuka lokal (status, mode, zona aktif, data sensor & hasil fuzzy)                                          |

---

## 8. Requirement Komunikasi (LoRa)

- Sensor node mengirim paket berisi minimal: **Node ID, soil moisture, temperature, humidity, timestamp/status**, idealnya juga tegangan baterai.
- Contoh format konseptual: `NODE01 | SOIL=38 | TEMP=31.2 | HUM=65 | BAT=12.4`
- Parameter yang wajib ditentukan sebelum implementasi: frekuensi LoRa, spreading factor, bandwidth, coding rate, daya transmisi, format paket, timeout, retry, ACK, dan mekanisme deteksi node offline.
- Frekuensi radio pada kedua unit **harus identik** (mis. sama-sama 433 MHz atau sama-sama 868/915 MHz) — perlu dicek terhadap regulasi ISM band lokal.
- Diuji dan diukur: jarak efektif, RSSI, packet loss, dan latency di lokasi sebenarnya.

---

## 9. Requirement Kontrol Irigasi & Pompa

- Sequential control: **hanya satu valve ON dalam satu waktu**; valve berikutnya baru ON setelah valve sebelumnya dipastikan OFF.
- Urutan konseptual: Pump ON (jika dikendalikan sistem) → Valve 1 ON → timer → OFF → delay → Valve 2 → … → Valve 13 → OFF → Pump OFF.
- **Dikonfirmasi:** pompa existing sudah memiliki _automatic pressure controller/pressure switch_. Sistem IoT **tidak mengendalikan pompa** — cukup mengendalikan 13 valve; penurunan tekanan akibat valve terbuka akan memicu pompa menyala otomatis secara mekanis/elektrik melalui pressure switch yang sudah terpasang, sepenuhnya independen dari sistem IoT.
- Konsekuensi desain: tidak diperlukan kontaktor/relay tambahan untuk motor pompa, tidak ada risiko beban induktif motor pada sisi elektronik kontrol IoT, dan skema fail-safe (§13) cukup fokus pada valve — bukan pompa.
- Tetap disarankan verifikasi ringan di lapangan: pastikan pressure switch berfungsi baik (pompa benar-benar menyala saat valve dibuka dan mati saat semua valve tertutup) sebelum sequential control diuji penuh, supaya tidak salah mengira sistem IoT yang bermasalah padahal sumber masalah di pompa/pressure switch.

### 9.1 Validasi ukuran pipa terhadap strategi sequential

Berdasarkan layout terukur (§19): pipa utama sebelum percabangan berukuran **1"**, bercabang menjadi **13 jalur berukuran 1/2"** masing-masing.

- Luas penampang pipa utama 1" ≈ 0,785 in²
- Luas penampang tiap cabang 1/2" ≈ 0,196 in²
- Rasio ≈ **4 : 1** — pipa utama cukup memadai memberi tekanan ke **satu** cabang 1/2" pada satu waktu.
- Jika 2–3 jalur terbuka bersamaan, pipa utama 1" sudah kurang; untuk 13 jalur sekaligus dibutuhkan setara pipa ±1,8".

Perhitungan ini **mengonfirmasi secara kuantitatif** bahwa sequential control (hanya 1 valve ON) bukan sekadar pilihan desain, melainkan keharusan hidrolik pada instalasi pipa existing. Ini juga menaikkan tingkat kepentingan mekanisme interlock (§13) — kegagalan interlock yang membuka 2 valve bersamaan berisiko menjatuhkan tekanan signifikan di kedua jalur.

> Catatan: perhitungan ini memakai diameter nominal, belum memperhitungkan ID aktual pipa (schedule pipa), panjang jalur, jumlah fitting/belokan, head elevasi, dan requirement tekanan minimum tiap sprinkler head — tetap wajib diuji tekanan & debit aktual di lapangan (§15).

---

## 10. Requirement Logika Fuzzy

- Metode: **Mamdani**, defuzzifikasi **Centroid**.
- Input:
  - Soil Moisture — Kering, Sedang, Basah
  - Temperature — Rendah, Normal, Tinggi
  - Air Humidity — Kering, Normal, Lembap
- Output: Water Demand 0–100% atau kategori (Tidak Perlu, Rendah, Sedang, Tinggi, Sangat Tinggi).
- Contoh rentang membership awal (bukan nilai final, wajib dikalibrasi lapangan):
  - Soil: Dry ~0–40%, Medium ~30–70%, Wet ~60–100%
  - Temperature: Low ~0–25 °C, Normal ~20–32 °C, High ~28–45 °C
  - Humidity: Dry ~0–50%, Normal ~40–75%, Humid ~65–100%
- Proses wajib mengikuti alur lengkap: fuzzification → rule evaluation/inference → aggregation → defuzzification → keputusan (bukan threshold biasa berlabel "fuzzy").
- Hasil fuzzy diterjemahkan menjadi **durasi penyiraman**, dikalibrasi berdasarkan debit sprinkler, luas area, kondisi tanah, tekanan air, dan hasil uji lapangan. Setiap jalur sebaiknya memiliki durasi dasar sendiri karena karakteristik tiap jalur berbeda.

---

## 11. Requirement Perangkat Lunak & Dashboard

| Layer            | Teknologi             |
| ---------------- | --------------------- |
| Frontend         | React.js              |
| Backend          | Node.js + Express.js  |
| Database         | MySQL                 |
| Protokol IoT     | MQTT                  |
| Real-time update | WebSocket / Socket.IO |

Dashboard menampilkan: data sensor real-time, status tiap valve, zona aktif, status pompa, mode sistem, histori penyiraman, jadwal, konfigurasi durasi per zona, dan kontrol manual.

**Mode operasi & prioritas perintah:** Safety/Interlock → Manual → Automatic → Schedule (keselamatan selalu prioritas tertinggi). Permintaan manual yang masuk saat sistem sedang menyiram **tidak langsung memutus** proses aktif — masuk ke antrean (queue) dan dijalankan setelah proses berjalan selesai, kecuali ada kondisi keselamatan.

---

## 12. Requirement Energi

- **Main system**: panel surya monocrystalline 30 W → MPPT 10 A → baterai 12 V → distribusi 12 V + LM2596 buck converter → 5 V untuk perangkat kontrol/periferal.
- **Sensor node** (jika dibuat mandiri): mini solar panel → solar charge controller → baterai → buck converter → controller + sensor. Kapasitas panel/baterai dihitung dari konsumsi aktual perangkat, pola sleep/wake, lama operasi, dan kondisi cuaca.
- Jika pompa 220 V AC tetap memakai PLN (bukan sistem baterai), maka kebutuhan energi surya difokuskan untuk elektronik kontrol/sensor saja — lebih realistis dibanding mencoba menjalankan pompa besar dari baterai 12 V via inverter.

---

## 13. Keamanan, Fail-Safe, dan Keterbatasan yang Diakui

**Mekanisme wajib:**

- Hard/software interlock — hanya satu valve aktif.
- Maximum watering time — valve dipaksa OFF bila melampaui batas.
- Watchdog timer untuk menangani ESP32 hang.
- Sensor timeout — data yang sudah terlalu lama tidak dipakai sebagai dasar keputusan.
- Fail-safe: error kritis → seluruh valve diarahkan ke kondisi OFF (didukung hardware oleh pin MR pada 74HC595, lihat §7.3).
- Proteksi beban induktif pada solenoid/relay, fuse/MCB DC sesuai cabang beban.
- Enclosure outdoor minimal IP65 dan cable gland.
- Kabel sinyal RS485 sebaiknya twisted pair dan dipisahkan dari kabel daya motor/solenoid.

**Keterbatasan yang diakui secara sadar (bukan bug, tapi batas cakupan versi ini):**

- Satu sensor kelembapan tanah tidak otomatis mewakili seluruh 13 jalur — sistem berorientasi ke zona fisik, bukan hardcode satu jenis tanaman.
- Tanpa flow sensor, sistem tidak tahu secara langsung apakah air benar-benar mengalir setelah valve ON.
- Tanpa feedback posisi valve, sistem mengasumsikan valve bekerja sesuai perintah.
- LoRa dapat mengalami packet loss — mitigasi via ACK/retry/timeout.
- Spesifikasi pompa, valve, kabel, dan baterai belum final — perhitungan daya/proteksi belum final sebelum verifikasi lapangan.

### 13.1 Mengapa keterbatasan ini bukan kelalaian

Sistem versi ini bekerja berbasis **perintah, bukan verifikasi fisik**: ESP32 mengirim sinyal "buka valve X", tapi tidak ada cara mengonfirmasi air benar-benar mengalir atau valve benar-benar bergerak. Ini keputusan sadar untuk membatasi scope TA (menghindari kompleksitas dan biaya hardware tambahan), bukan sesuatu yang terlewat — sehingga mekanisme fail-safe (interlock, maximum watering time, watchdog) menjadi lebih penting karena semuanya berjalan atas dasar **asumsi** perintah berhasil dieksekusi.

### 13.2 Potensi Pengembangan Lanjutan (Future Work)

Dua penambahan berikut tidak termasuk dalam scope versi ini (§4.2), tapi dicatat sebagai jalur pengembangan lanjutan yang jelas — baik untuk potensi kelanjutan proyek maupun sebagai jawaban siap pakai saat sidang TA:

**a. Flow sensor (sensor aliran air)**

- Contoh komponen: sensor flow tipe pulsa (mis. YF-S201/YF-S401) dipasang di pipa utama 1" sebelum percabangan.
- Prinsip kerja: menghasilkan pulsa sebanding dengan debit air yang lewat; ESP32 menghitung pulsa untuk estimasi liter/menit.
- Manfaat: saat valve seharusnya terbuka tapi flow terbaca 0 (atau jauh di bawah ekspektasi), sistem bisa mendeteksi kondisi abnormal (pipa tersumbat, valve macet, kebocoran besar di jalur lain) dan mengeluarkan alert ke dashboard — bukan cuma diam menganggap semua baik-baik saja.
- Titik integrasi: dapat dipasang di main controller (butuh 1 GPIO tambahan untuk interrupt pulsa — cek ketersediaan pin di §7.3/7.4 sebelum menambahkan).

**b. Feedback posisi/status valve**

- Opsi sederhana: sensor arus (current sensor, mis. ACS712) pada jalur kabel tiap solenoid valve — kalau valve seharusnya ON tapi arus terbaca ~0, berarti valve tidak benar-benar aktif (coil putus, kabel lepas, atau relay gagal switching).
- Opsi lain: limit switch mekanis pada valve (jika modelnya mendukung), memberi status terbuka/tertutup secara langsung.
- Manfaat: menutup kesenjangan antara "status software" dan "kondisi fisik sebenarnya", sehingga dashboard bisa menampilkan status valve yang benar-benar terverifikasi, bukan cuma asumsi dari histori perintah yang dikirim.

**c. Dampak ke arsitektur bila ditambahkan**

- Kedua penambahan ini murni bersifat **aditif** — tidak mengubah arsitektur inti (sequential control, interlock, fuzzy) yang sudah dirancang, hanya menambah lapisan verifikasi/alert di atasnya.
- Disarankan sebagai pengembangan tahap kedua **setelah** sistem versi dasar (tanpa flow sensor/feedback) sudah berjalan stabil, bukan digabung ke dalam scope & timeline yang sudah ditarget selesai November (lihat timeline pengerjaan terpisah).

---

## 14. Risiko Teknis & Mitigasi

| Risiko                           | Dampak                       | Mitigasi                                            |
| -------------------------------- | ---------------------------- | --------------------------------------------------- |
| Tekanan air rendah               | Penyiraman tidak optimal     | Sequential irrigation, satu jalur per waktu         |
| Voltage drop kabel valve         | Valve tidak menarik sempurna | Hitung voltage drop, pilih kabel sesuai             |
| Valve gagal bekerja              | Air tidak mengalir           | Monitoring arus/flow sensor (pengembangan lanjutan) |
| Sensor offline                   | Keputusan salah              | Timeout, status offline, fail-safe                  |
| Internet putus                   | Kontrol web terganggu        | Core control tetap di ESP32                         |
| LoRa packet loss                 | Data/perintah tidak diterima | ACK, retry, timeout, status komunikasi              |
| ESP32 hang                       | Valve berhenti tidak sesuai  | Watchdog & maximum runtime                          |
| Dua valve ON bersamaan           | Tekanan air makin turun      | Interlock hardware/software                         |
| Spike dari solenoid              | Gangguan/reset elektronik    | Flyback/surge suppression, pemisahan jalur daya     |
| Fuzzy tidak sesuai lapangan      | Penyiraman berlebih/kurang   | Kalibrasi dengan data lapangan                      |
| Satu sensor mewakili banyak zona | Data tidak representatif     | Multi-node atau representative sampling point       |

---

## 15. Hal yang Wajib Diverifikasi di Lapangan Sebelum Implementasi

- Fungsi pressure switch pompa (sudah dikonfirmasi ada) — pastikan menyala/mati otomatis dengan benar sesuai tekanan saat valve dibuka/ditutup.
- Tegangan dan arus coil solenoid valve; tipe valve NC/NO; ukuran valve & fitting.
- Tekanan dan debit air tiap jalur; panjang kabel panel ke tiap valve.
- Kapasitas baterai yang dipilih.
- Spesifikasi sensor RS485 dan register Modbus.
- **Revisi board Heltec WiFi LoRa32 V3** yang benar-benar dibeli (verifikasi pin fisik).
- Jarak sensor node ke main controller dan kondisi penghalang (untuk uji LoRa).
- Posisi sensor tanah agar representatif terhadap area yang dipantau.

---

## 16. Urutan Pengerjaan (Development Sequence)

1. Survey & dokumentasi sistem existing.
2. Verifikasi pompa, pipa, valve, tekanan air, jalur kabel.
3. Uji satu solenoid valve dengan catu daya sesuai.
4. Uji DHT22.
5. Uji Soil Moisture RS485 + MAX485 + Modbus.
6. Uji komunikasi LoRa (jarak/RSSI/packet loss/latency).
7. Uji 74HC595 + driver + relay.
8. Uji sequential control Valve 1–13 tanpa fuzzy.
9. Implementasi queue & interlock.
10. Implementasi fuzzy Mamdani.
11. Kalibrasi membership function & rule base.
12. Hubungkan fuzzy dengan durasi penyiraman.
13. Tambahkan schedule (08:00 & 16:00).
14. Tambahkan manual control.
15. Bangun web dashboard & database.
16. Integrasikan sistem energi surya.
17. Pengujian keseluruhan & dokumentasi.

---

## 17. Pembagian Subsistem (untuk TA Kelompok)

| Subsistem                         | Cakupan                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| Sensor & Komunikasi               | DHT22, Soil Moisture RS485/MAX485, protokol paket LoRa, uji jarak/RSSI                  |
| Fuzzy & Algoritma Kontrol         | Fuzzifikasi, rule base, defuzzifikasi, pemetaan ke durasi penyiraman, queue & interlock |
| Kendali Valve / Power Electronics | 74HC595, driver ULN2803, relay 16ch, wiring valve, catu daya & proteksi                 |
| Web / Dashboard & Database        | React frontend, Node.js/Express backend, MySQL, MQTT, WebSocket                         |

Seluruh subsistem tetap harus disatukan dalam satu arsitektur sistem yang konsisten (lihat §6).

---

## 18. Open Questions

- Frekuensi LoRa final: 433 MHz atau 868/915 MHz — menyesuaikan regulasi & ketersediaan modul.
- Apakah sensor node akan dibuat sepenuhnya mandiri dengan panel surya, atau memakai catu daya kabel jika jarak ke panel memungkinkan?
- Nilai final membership function & rule base fuzzy — menunggu hasil kalibrasi lapangan.
- Apakah akan ditambahkan flow sensor pada pengembangan lanjutan untuk menutup keterbatasan feedback aliran air?
- Apa fungsi simbol valve tambahan di tengah Jalur 3 pada layout awal (§19) — valve kedua, atau penanda lain? Perlu dicek ke lapangan.

---

## 19. Lampiran: Layout Taman & Spesifikasi Pipa (Halaman Depan BRMP Jakarta)

Berdasarkan denah _"Layout Sprinkle dan Tanaman"_ dan hasil pengukuran lapangan.

### 19.1 Spesifikasi pipa

- Pipa utama (sebelum percabangan): **1 inci**
- Pipa cabang menuju tiap jalur/valve (setelah percabangan): **1/2 inci**, untuk seluruh 13 jalur
- Validasi rasio penampang pipa terhadap strategi sequential control: lihat §9.1

### 19.2 Jumlah petak & titik sprinkler per jalur

| Jalur     | Jumlah Petak | Sprinkler per Petak | Total Sprinkler/Jalur |
| --------- | ------------ | ------------------- | --------------------- |
| 1         | 3            | 2, 2, 2             | 6                     |
| 2         | 3            | 2, 2, 3             | 7                     |
| 3         | 3            | 1, 2, 3             | 6                     |
| 4         | 3            | 0, 2, 3             | 5                     |
| 5         | 4            | 0, 2, 2, 1          | 5                     |
| 6         | 4            | 2, 2, 2, 1          | 7                     |
| 7         | 3            | 2, 2, 0             | 4                     |
| 8         | 3            | 2, 2, 0             | 4                     |
| 9         | 4            | 2, 2, 2, 1          | 7                     |
| 10        | 4            | 0, 2, 2, 2          | 6                     |
| 11        | 4            | 0, 2, 2, 2          | 6                     |
| 12        | 4            | 2, 2, 2, 2          | 8                     |
| 13        | 1            | 8                   | 8                     |
| **Total** | **43**       | —                   | **79**                |

Catatan: angka "0" pada sebagian petak berarti petak tersebut dilalui jalur pipa tetapi belum/tidak memiliki titik sprinkler aktif — perlu dikonfirmasi apakah ini memang kondisi terpasang atau bagian yang belum lengkap instalasinya.

### 19.3 Implikasi terhadap desain sistem

- Jalur dengan jumlah sprinkler lebih banyak (mis. Jalur 13 dengan 8 titik dalam 1 petak, atau Jalur 12 dengan 8 titik di 4 petak) kemungkinan butuh **durasi penyiraman berbeda** dibanding jalur dengan sprinkler lebih sedikit (mis. Jalur 7/8 dengan 4 titik) — mendukung keputusan di §10 bahwa tiap jalur idealnya punya durasi dasar sendiri, bukan durasi seragam untuk semua jalur.
- Total 79 titik sprinkler dari pipa cabang 1/2" per jalur — jadi dasar perhitungan kebutuhan debit per jalur saat verifikasi lapangan (§15).

---

_Dokumen ini adalah draft hidup — wajib diperbarui seiring hasil verifikasi lapangan (§15) dan hasil pengujian bertahap (§16)._
