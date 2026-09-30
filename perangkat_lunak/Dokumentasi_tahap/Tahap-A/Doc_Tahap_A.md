# Tahap A

## 1. ERD

<<<<<<< HEAD
terdapat 11 table
=======
![gambaran ERD](perangkat_lunak/Dokumentasi_tahap/Tahap-A/ERD/ERD_kebutuhan_DB.png)
>>>>>>> c7de770a2e035407150e27637498c66b5b8d50ab

1. users
2. devices
3. zones
4. sensor_readings
5. irrigation_sessions
6. irrigation_logs
7. schedules
8. schedule_zones
9. system_settings
10. audit_logs
11. mqtt_logs

dengan relasi berikut:

```
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

[gambar erd](Fatrue/Magang_TA_AEIOU/perangkat_lunak/Dokumentasi_tahap/Tahap-A/ERD/ERD_kebutuhan_DB.png)
