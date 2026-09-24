# Visualisasi ERD

                       ┌─────────────────┐
                       │      users      │
                       ├─────────────────┤
                       │ PK id           │
                       │ name            │
                       │ email           │
                       │ password_hash   │
                       │ role            │
                       └───────┬─────────┘
                               │
                 ┌─────────────┴──────────────┐
                 │                            │
                 │ 1:N                        │ 1:N
                 ▼                            ▼
       ┌───────────────────┐        ┌────────────────┐
       │ irrigation_sessions│        │   audit_logs   │
       ├───────────────────┤        ├────────────────┤
       │ PK id             │        │ PK id          │
       │ request_id        │        │ FK user_id     │
       │ mode              │        │ action         │
       │ trigger           │        │ resource       │
       │ status            │        │ request_id     │
       │ created_by FK     │        │ details        │
       └─────────┬─────────┘        └────────────────┘
                 │
                 │ 1:N
                 ▼
       ┌───────────────────┐
       │  irrigation_logs  │
       ├───────────────────┤
       │ PK id             │
       │ FK session_id     │
       │ FK zone_id        │
       │ sequence_no       │
       │ start_time        │
       │ end_time          │
       │ duration          │
       │ status            │
       │ request_id        │
       └─────────┬─────────┘
                 │
                 │ N:1
                 ▼
          ┌──────────────┐
          │    zones     │
          ├──────────────┤
          │ PK id        │
          │ zone_number  │
          │ name         │
          │ sprinkler_count
          │ default_duration
          │ enabled      │
          └──────────────┘


          ┌──────────────┐
          │   devices    │
          ├──────────────┤
          │ PK id        │
          │ device_id    │
          │ type         │
          │ status       │
          │ last_seen    │
          └──────┬───────┘
                 │
                 │ 1:N
                 ▼
       ┌───────────────────┐
       │ sensor_readings   │
       ├───────────────────┤
       │ PK id             │
       │ FK device_id      │
       │ soil_moisture     │
       │ temperature       │
       │ humidity          │
       │ fuzzy_output      │
       │ battery_voltage   │
       │ rssi              │
       │ timestamp         │
       └───────────────────┘


       ┌──────────────────┐
       │    schedules     │
       ├──────────────────┤
       │ PK id            │
       │ name             │
       │ time             │
       │ mode             │
       │ days             │
       │ enabled          │
       │ version          │
       └──────────────────┘


       ┌──────────────────┐
       │ system_settings  │
       ├──────────────────┤
       │ PK id            │
       │ setting_key      │
       │ setting_value    │
       └──────────────────┘


       ┌──────────────────┐
       │    mqtt_logs     │
       ├──────────────────┤
       │ PK id            │
       │ topic            │
       │ direction        │
       │ payload          │
       │ device_id        │
       │ request_id       │
       │ timestamp        │
       └──────────────────┘
