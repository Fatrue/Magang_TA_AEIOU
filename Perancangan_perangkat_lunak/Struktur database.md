# Struktur Database

(versi mvp / inti), total 10 tabel :

```
users
devices
zones
sensor_readings
irrigation_sessions
irrigation_logs
schedules
system_settings
audit_logs
mqtt_logs
```

## 1. Tabel `users`

Digunakan untuk autentikasi pengguna web.
| Field | Type | Keterangan |
| ------------- | ------------ | ----------------- |
| id | INT | PK |
| name | VARCHAR(100) | Nama pengguna |
| email | VARCHAR(150) | Unique |
| password_hash | VARCHAR(255) | Password ter-hash |
| role | ENUM | ADMIN / OPERATOR |
| created_at | DATETIME | Waktu dibuat |
| updated_at | DATETIME | Waktu diperbarui |

---

Untuk MVP kita tidak perlu RBAC kompleks.

Cukup:

```
ADMIN
OPERATOR
```

> Keduanya tetap melewati backend validation sebelum bisa mengirim command ke controller.

## 2. Tabel `devices`

Mewakili perangkat IoT.

Contoh:

```
MAIN-01
SENSOR-01
```

| Field      | Type         | Keterangan                    |
| ---------- | ------------ | ----------------------------- |
| id         | INT          | PK                            |
| device_id  | VARCHAR(50)  | Unique                        |
| name       | VARCHAR(100) | Nama perangkat                |
| type       | ENUM         | MAIN_CONTROLLER / SENSOR_NODE |
| status     | ENUM         | ONLINE / OFFLINE / ERROR      |
| last_seen  | DATETIME     | Terakhir komunikasi           |
| created_at | DATETIME     |                               |
| updated_at | DATETIME     |                               |

Relasi:

```
devices 1 ─── N sensor_readings
devices 1 ─── N mqtt_logs
```

## 3. Tabel `zones`

penting karena sistem memiliki 13 zona
| Field | Type | Keterangan |
| ---------------- | ------------ | -------------------------- |
| id | INT | PK |
| zone_number | INT | 1–13 |
| name | VARCHAR(100) | Nama zona |
| sprinkler_count | INT | Jumlah sprinkler |
| default_duration | INT | Durasi default dalam detik |
| enabled | BOOLEAN | Zona aktif/tidak |
| created_at | DATETIME | |
| updated_at | DATETIME | |

---

Constraint:

```
zone_number UNIQUE
```

Sehingga tidak mungkin ada:

```
Zone 1
Zone 1
```

> default_duration digunakan sebagai durasi bawaan zona apabila tidak terdapat pengaturan khusus dari schedule atau mekanisme lainnya.

## 4. Table `sensor_readings`

Menyimpan histori pembacaan sensor.
| Field | Type | Keterangan |
| --------------- | ------------ | --------------- |
| id | BIGINT | PK |
| device_id | INT | FK → devices.id |
| soil_moisture | DECIMAL(5,2) | Kelembapan tanah (%) |
| temperature | DECIMAL(5,2) | Suhu udara (°C) |
| humidity | DECIMAL(5,2) | Kelembapan udara (%) |
| fuzzy_output | DECIMAL(5,2) | Output fuzzy 0–100 |
| battery_voltage | DECIMAL(6,2) | Tegangan baterai (V) |
| rssi | INT | RSSI LoRa |
| timestamp | DATETIME | Waktu pembacaan |

---

Relasi:

```
devices 1 ─── N sensor_readings
```

### Catatan fuzzy:

Fuzzy tetap dijalankan di ESP32, **bukan di database/backend**. Database hanya menyimpan hasilnya untuk monitoring dan histori.
Alurnya:

```
Sensor
   ↓
ESP32
   ↓
Fuzzy Mamdani
   ↓
Fuzzy Output
   ↓
Keputusan penyiraman
   ↓
Database menyimpan hasil
```

fuzzy_output disimpan agar hasil keputusan dapat ditampilkan dan dianalisis kembali.

## 5. Table `irrigation_sessions`

Satu session = satu rangkaian permintaan penyiraman.

Contoh:

```
Session #125
Mode      = AUTOMATIC
Trigger   = SCHEDULE
RequestID = abc123
Status    = COMPLETED
```

| Field       | Type          | Keterangan                                                         |
| ----------- | ------------- | ------------------------------------------------------------------ |
| id          | BIGINT        | PK                                                                 |
| request_id  | VARCHAR(50)   | Unique                                                             |
| mode        | ENUM          | MANUAL / AUTOMATIC / SYSTEM                                        |
| trigger     | ENUM          | USER / SCHEDULE / FUZZY / SYSTEM                                   |
| started_at  | DATETIME      | Waktu mulai                                                        |
| finished_at | DATETIME NULL | Waktu selesai                                                      |
| status      | ENUM          | QUEUED / RUNNING / COMPLETED / FAILED / CANCELLED / EMERGENCY_STOP |
| created_by  | INT NULL      | FK → users.id                                                      |

---

Relasi:

```
users 1 ─── N irrigation_sessions
irrigation_sessions 1 ─── N irrigation_logs
```

### `mode`

```
MANUAL
AUTOMATIC
SYSTEM
```

### `trigger`

```
USER
SCHEDULE
FUZZY
SYSTEM
```

Contohnya:
| Skenario | Mode | Trigger |
| ------------------- | --------- | -------- |
| User menekan Zone 5 | MANUAL | USER |
| Jadwal pukul 07:30 | AUTOMATIC | SCHEDULE |
| Keputusan fuzzy | AUTOMATIC | FUZZY |
| Emergency recovery | SYSTEM | SYSTEM |

---

Dengan pemisahan ini, `mode` dan `trigger` tidak tercampur.

## 6. Table `irrigation_logs`

Ini menyimpan detail masing-masing zona dalam sebuah session.

Misalnya:

```
Session 125

Zone 1 → 300 sec
Zone 2 → 240 sec
Zone 3 → 360 sec
...
```

| Field       | Type          | Keterangan                                        |
| ----------- | ------------- | ------------------------------------------------- |
| id          | BIGINT        | PK                                                |
| session_id  | BIGINT        | FK → irrigation_sessions.id                       |
| zone_id     | INT           | FK → zones.id                                     |
| sequence_no | INT           | Urutan penyiraman                                 |
| start_time  | DATETIME NULL | Waktu mulai                                       |
| end_time    | DATETIME NULL | Waktu selesai                                     |
| duration    | INT           | Durasi aktual dalam detik                         |
| status      | ENUM          | QUEUED / RUNNING / COMPLETED / FAILED / CANCELLED |
| request_id  | VARCHAR(50)   | ID request                                        |
| created_at  | DATETIME      |                                                   |

---

Relasi:

```
irrigation_sessions 1 ─── N irrigation_logs
zones                1 ─── N irrigation_logs
```

`sequence_no` penting untuk membuktikan:

```
1 → Zone 1
2 → Zone 2
3 → Zone 3
...
13 → Zone 13
```

Dan bukan misalnya:

```
Zone 1 + Zone 2 aktif bersamaan
```

**Kenapa duration disimpan di sini?**

Karena ini adalah durasi aktual yang benar-benar digunakan.

Misalnya:

```
Jadwal      : 120 detik
Fuzzy       : 80%
Durasi aktual: 150 detik
```

Maka irrigation_logs.duration:

```
150
```

Jadi histori tidak berubah meskipun konfigurasi schedule nantinya diedit.

## 7. Table `schedules`

Digunakan untuk menyimpan jadwal penyiraman.

| Field         | Type         | Keterangan                  |
| ------------- | ------------ | --------------------------- |
| id            | INT          | PK                          |
| name          | VARCHAR(100) | Nama jadwal                 |
| schedule_type | ENUM         | RECURRING / ONCE            |
| time          | TIME         | Jam penyiraman              |
| days          | JSON NULL    | Hari untuk jadwal berulang  |
| date          | DATE NULL    | Tanggal untuk jadwal sekali |
| mode          | ENUM         | FIXED / FUZZY               |
| enabled       | BOOLEAN      | Jadwal aktif/tidak          |
| version       | INT          | Versi konfigurasi           |
| created_at    | DATETIME     |                             |
| updated_at    | DATETIME     |                             |

---

`version` digunakan untuk schedule synchronization.

Contoh:

```
Backend Schedule Version = 8
ESP32 Schedule Version    = 7

→ backend kirim SYNC_SCHEDULE
→ ESP32 menerima
→ ESP32 ACK version 8
```

schedule_type

```
RECURRING
ONCE
```

Contoh jadwal berulang:

```
Nama           : Penyiraman Pagi
Type           : RECURRING
Time           : 07:30
Days           : ["MON","WED","FRI"]
```

Artinya penyiraman dilakukan setiap:

```
Senin 07:30
Rabu  07:30
Jumat 07:30
```

Contoh jadwal sekali:

```
Nama           : Penyiraman Tanaman Baru
Type           : ONCE
Date           : 2026-10-01
Time           : 09:00
```

Setelah jadwal sekali dijalankan, sistem dapat otomatis mengubah:

```
enabled = false
```

### `mode`

Ini menentukan bagaimana durasi penyiraman ditentukan.

```
FIXED
FUZZY
```

FIXED:

```
Schedule
   ↓
Durasi dari schedule_zones
   ↓
Penyiraman
```

FUZZY:

```
Schedule
   ↓
Baca sensor
   ↓
Fuzzy
   ↓
Durasi hasil fuzzy
   ↓
Penyiraman
```

lebih jelas daripada mencampurkan SCHEDULE dan FUZZY sebagai mode.

## 8. Table `schedule_zones`

Digunakan untuk menentukan zona mana saja yang termasuk dalam suatu schedule serta durasinya.
| Field | Type | Keterangan |
| ----------- | ------- | ------------------------- |
| id | INT | PK |
| schedule_id | INT | FK → schedules.id |
| zone_id | INT | FK → zones.id |
| duration | INT | Durasi dalam detik |
| sequence_no | INT | Urutan penyiraman |
| enabled | BOOLEAN | Zona aktif dalam schedule |

Relasi:

```
schedules 1 ─── N schedule_zones
zones     1 ─── N schedule_zones
```

Contoh:

```
Penyiraman Pagi
│
├── Zone 1 → 60 detik
├── Zone 2 → 90 detik
├── Zone 3 → 120 detik
└── Zone 4 → 60 detik
```

Dengan ini durasi tiap zona dapat diatur berbeda untuk setiap jadwal.

Misalnya:

```
Jadwal Pagi
Zone 1 → 60 detik

Jadwal Sore
Zone 1 → 120 detik
```

Tidak perlu mengubah zones.default_duration.

## 9. Table `system_settings`

Untuk konfigurasi sistem yang bersifat global.

| Field         | Type         | Keterangan        |
| ------------- | ------------ | ----------------- |
| id            | INT          | PK                |
| setting_key   | VARCHAR(100) | Unique            |
| setting_value | VARCHAR(255) | Nilai konfigurasi |
| updated_at    | DATETIME     | Waktu diperbarui  |

Contoh:
| key | value |
| ------------------ | ----: |
| max_zone_runtime | 600 |
| sensor_timeout | 180 |
| telemetry_interval | 60 |
| system_mode | AUTO |

---

> Catatan: konfigurasi yang menyangkut safety fisik **tetap harus memiliki batas maksimum di firmware ESP32**, bukan hanya di database.

## 10. Table `audit_logs`

Digunakan untuk mencatat tindakan pengguna.
Contoh:

```
07:45
Bram
START_IRRIGATION
ZONE 5
requestId abc123
```

| Field       | Type             | Keterangan         |
| ----------- | ---------------- | ------------------ |
| id          | BIGINT           | PK                 |
| user_id     | INT NULL         | FK → users.id      |
| action      | VARCHAR(100)     | Jenis aktivitas    |
| resource    | VARCHAR(100)     | Objek yang diakses |
| resource_id | VARCHAR(50) NULL | ID objek           |
| request_id  | VARCHAR(50) NULL | ID request         |
| details     | JSON NULL        | Detail aktivitas   |
| ip_address  | VARCHAR(45) NULL | IP pengguna        |
| created_at  | DATETIME         | Waktu aktivitas    |

---

Contoh `action`:

```
LOGIN
LOGOUT
START_IRRIGATION
STOP_IRRIGATION
EMERGENCY_STOP
UPDATE_ZONE
CREATE_SCHEDULE
UPDATE_SCHEDULE
DELETE_SCHEDULE
```

Relasi:

```
users 1 ─── N audit_logs
```

## 11. Table `mqtt_logs`

Digunakan untuk debugging dan troubleshooting komunikasi MQTT.
| Field | Type | Keterangan |
| ---------- | ---------------- | ----------------- |
| id | BIGINT | PK |
| topic | VARCHAR(255) | MQTT topic |
| direction | ENUM | PUBLISH / RECEIVE |
| payload | JSON | Isi pesan |
| device_id | INT NULL | FK → devices.id |
| request_id | VARCHAR(50) NULL | ID request |
| timestamp | DATETIME | Waktu pesan |

---

Direction:

```
PUBLISH
RECEIVE
```

Contoh:

```
Direction : RECEIVE
Topic     : brmp/irrigation/status
Device    : MAIN-01
RequestID : abc123
```

> Untuk MVP, MQTT log tidak perlu menjadi fitur dashboard. Fungsinya terutama untuk **debugging dan troubleshooting**.
