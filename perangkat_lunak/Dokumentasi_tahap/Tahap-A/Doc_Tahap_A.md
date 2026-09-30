# Tahap A

Tahap A merupakan tahap perancangan awal sistem sebelum masuk ke proses implementasi. Pada tahap ini dilakukan perancangan database menggunakan ERD, pembuatan database MySQL, serta integrasi database dengan Prisma ORM.

## 1. ERD

Perancangan database dilakukan menggunakan Entity Relationship Diagram (ERD). Database sistem terdiri dari 11 tabel, yaitu:

1. `users`
2. `devices`
3. `zones`
4. `sensor_readings`
5. `irrigation_sessions`
6. `irrigation_logs`
7. `schedules`
8. `schedule_zones`
9. `system_settings`
10. `audit_logs`
11. `mqtt_logs`

Relasi antar tabel adalah sebagai berikut:

```text
users
 ├── 1:N irrigation_sessions
 └── 1:N audit_logs

devices
 ├── 1:N sensor_readings
 └── 1:N mqtt_logs

zones
 ├── 1:N irrigation_logs
 └── 1:N schedule_zones

schedules
 └── 1:N schedule_zones

irrigation_sessions
 └── 1:N irrigation_logs
```

ERD yang telah dibuat:

![ERD](perangkat_lunak/Dokumentasi_tahap/Tahap-A/ERD/ERD_kebutuhan_DB.png)

## 2. MySQL dan Prisma

### 2.1 Pembuatan Database MySQL

MySQL digunakan sebagai database utama untuk menyimpan data yang digunakan oleh sistem. Database dibuat dengan nama:

```text
brmp_irrigation
```

Pembuatan database dilakukan melalui MySQL Workbench. Pada tahap ini database masih dalam kondisi kosong dan belum terdapat tabel.

### 2.2 Instalasi Prisma

Prisma digunakan sebagai ORM (Object-Relational Mapping) untuk menghubungkan aplikasi backend dengan database MySQL.

Versi Prisma yang digunakan:

```text
prisma          : 6.19.3
@prisma/client  : 6.19.3
```

Prisma diinstal pada folder backend menggunakan perintah:

```bash
npm install @prisma/client@6
npm install -D prisma@6
```

### 2.3 Konfigurasi Prisma

Setelah Prisma terpasang, dibuat file schema pada:

```text
backend/prisma/schema.prisma
```

Schema Prisma digunakan untuk mendefinisikan struktur tabel, field, enum, primary key, foreign key, serta relasi antar tabel yang sebelumnya telah dirancang pada ERD.

Datasource yang digunakan adalah MySQL:

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

Koneksi database disimpan pada file `.env` menggunakan variabel:

```text
DATABASE_URL
```

Password database tidak dituliskan secara langsung di dalam dokumentasi maupun source code yang akan dibagikan.

### 2.4 Validasi Schema Prisma

Setelah schema selesai dibuat, dilakukan validasi menggunakan perintah:

```bash
npx prisma validate
```

Hasil validasi menunjukkan bahwa schema Prisma telah valid sehingga dapat dilanjutkan ke tahap migrasi database.

### 2.5 Migrasi Database

Migrasi database dilakukan menggunakan:

```bash
npx prisma migrate dev --name init
```

Perintah tersebut digunakan untuk membuat migration awal berdasarkan schema Prisma dan menerapkan struktur tabel ke database `brmp_irrigation`.

Pada tahap ini ditemukan kendala autentikasi MySQL berupa:

```text
Error: P1000: Authentication failed against database server,
the provided database credentials for `root` are not valid.
```

Kendala tersebut berkaitan dengan kredensial koneksi MySQL, bukan dengan struktur schema Prisma. Oleh karena itu, konfigurasi koneksi database perlu diperiksa sebelum proses migrasi dapat dilanjutkan.
