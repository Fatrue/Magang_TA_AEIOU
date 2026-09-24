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
> `

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

## 4. Table `sensor_readings`

Menyimpan histori pembacaan sensor.
| Field | Type | Keterangan |
| --------------- | ------------ | --------------- |
| id | BIGINT | PK |
| device_id | INT | FK devices |
| soil_moisture | DECIMAL(5,2) | % |
| temperature | DECIMAL(5,2) | °C |
| humidity | DECIMAL(5,2) | % |
| fuzzy_output | DECIMAL(5,2) | 0–100 |
| battery_voltage | DECIMAL(6,2) | Volt |
| rssi | INT | RSSI LoRa |
| timestamp | DATETIME | Waktu pembacaan |

---

Catatan penting:

> Fuzzy tetap dijalankan di ESP32, bukan di database/backend.

Database hanya menyimpan hasilnya untuk monitoring dan histori.

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

| Field       | Type               |
| ----------- | ------------------ |
| id          | BIGINT PK          |
| request_id  | VARCHAR(50) UNIQUE |
| mode        | ENUM               |
| trigger     | ENUM               |
| started_at  | DATETIME           |
| finished_at | DATETIME NULL      |
| status      | ENUM               |
| created_by  | INT NULL           |

---

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
| Skenario | mode | trigger |
| ------------------------ | --------- | -------- |
| User menekan Zone 5 | MANUAL | USER |
| Jadwal 08:00 | AUTOMATIC | SCHEDULE |
| Fuzzy memulai penyiraman | AUTOMATIC | FUZZY |
| Emergency recovery | SYSTEM | SYSTEM |

---

Ini menghindari masalah sebelumnya ketika SCHEDULE dianggap sebagai mode.

**Status**

```
QUEUED
RUNNING
COMPLETED
FAILED
CANCELLED
EMERGENCY_STOP
```

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

| Field       | Type          |
| ----------- | ------------- |
| id          | BIGINT PK     |
| session_id  | BIGINT FK     |
| zone_id     | INT FK        |
| sequence_no | INT           |
| start_time  | DATETIME NULL |
| end_time    | DATETIME NULL |
| duration    | INT           |
| status      | ENUM          |
| request_id  | VARCHAR(50)   |
| created_at  | DATETIME      |

---

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

## 7. Table `schedules`

Menyimpan jadwal penyiraman.
| Field | Type |
| ---------- | ------------ |
| id | INT PK |
| name | VARCHAR(100) |
| time | TIME |
| mode | ENUM |
| days | JSON |
| enabled | BOOLEAN |
| version | INT |
| created_at | DATETIME |
| updated_at | DATETIME |

---

Contoh:

```
{
  "days": [
    "MON",
    "WED",
    "FRI"
  ]
}
```

`version` digunakan untuk schedule synchronization.

Contoh:

```
Backend Schedule Version = 8
ESP32 Schedule Version    = 7

→ backend kirim SYNC_SCHEDULE
→ ESP32 menerima
→ ESP32 ACK version 8
```

Jadi kebutuhan offline schedule menjadi lebih jelas.

## 8. Table `system_settings`

Untuk konfigurasi sistem yang bersifat global.
contoh:

```
| key                | value |
| ------------------ | ----- |
| max_zone_runtime   | 600   |
| sensor_timeout     | 180   |
| telemetry_interval | 60    |
| system_mode        | AUTO  |
```

Strukturnya:
| Field | Type |
| ------------- | ------------------- |
| id | INT PK |
| setting_key | VARCHAR(100) UNIQUE |
| setting_value | VARCHAR(255) |
| updated_at | DATETIME |

---

> Catatan: konfigurasi yang menyangkut safety fisik **tetap harus memiliki batas maksimum di firmware ESP32**, bukan hanya di database.

## 9. Table `audit_logs`

Digunakan untuk mencatat tindakan pengguna.
Contoh:

```
07:45
Bram
START_IRRIGATION
ZONE 5
requestId abc123
```

Field:
| Field | Type |
| ----------- | ---------------- |
| id | BIGINT PK |
| user_id | INT NULL |
| action | VARCHAR(100) |
| resource | VARCHAR(100) |
| resource_id | VARCHAR(50) NULL |
| request_id | VARCHAR(50) NULL |
| details | JSON NULL |
| ip_address | VARCHAR(45) NULL |
| created_at | DATETIME |

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

## 10. Table `mqtt_logs`

Untuk debugging dan troubleshooting komunikasi.
| Field | Type |
| ---------- | ---------------- |
| id | BIGINT PK |
| topic | VARCHAR(255) |
| direction | ENUM |
| payload | JSON |
| device_id | INT NULL |
| request_id | VARCHAR(50) NULL |
| timestamp | DATETIME |

---

Direction:

```
PUBLISH
RECEIVE
```

Contoh:

```
RECEIVE
brmp/irrigation/status
SENSOR/MAIN
requestId=abc123
```

> Untuk MVP, tidak perlu membuat seluruh MQTT log sebagai fitur dashboard. Ini terutama untuk debugging.
