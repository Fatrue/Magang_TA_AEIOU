# Visualisasi ERD

                         ┌─────────────────┐
                         │      users      │
                         ├─────────────────┤
                         │ PK id           │
                         │ name            │
                         │ email           │
                         │ password_hash   │
                         │ role            │
                         │ created_at      │
                         │ updated_at      │
                         └───────┬─────────┘
                                 │
                    ┌────────────┴────────────┐
                    │ 1:N                     │ 1:N
                    ▼                         ▼
          ┌───────────────────┐       ┌────────────────┐
          │irrigation_sessions│       │   audit_logs   │
          ├───────────────────┤       ├────────────────┤
          │ PK id             │       │ PK id          │
          │ request_id        │       │ FK user_id     │
          │ mode              │       │ action         │
          │ trigger           │       │ resource       │
          │ started_at        │       │ resource_id    │
          │ finished_at       │       │ request_id     │
          │ status            │       │ details        │
          │ FK created_by     │       │ ip_address     │
          └─────────┬─────────┘       │ created_at     │
                    │                 └────────────────┘
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
          │ created_at        │
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
             │ created_at   │
             │ updated_at   │
             └──────┬───────┘
                    │
                    │ 1:N
                    ▼
          ┌──────────────────┐
          │ schedule_zones   │
          ├──────────────────┤
          │ PK id            │
          │ FK schedule_id   │
          │ FK zone_id       │
          │ duration         │
          │ sequence_no      │
          │ enabled          │
          └────────┬─────────┘
                   │
                   │ N:1
                   ▼
          ┌──────────────────┐
          │    schedules     │
          ├──────────────────┤
          │ PK id            │
          │ name             │
          │ schedule_type    │
          │ time             │
          │ days             │
          │ date             │
          │ mode             │
          │ enabled          │
          │ version          │
          │ created_at       │
          │ updated_at       │
          └──────────────────┘

```
          ┌──────────────────┐
          │     devices      │
          ├──────────────────┤
          │ PK id            │
          │ device_id        │
          │ name             │
          │ type             │
          │ status            │
          │ last_seen        │
          │ created_at       │
          │ updated_at       │
          └───────┬──────────┘
                  │
          ┌───────┴──────────────┐
          │ 1:N                  │ 1:N
          ▼                      ▼
 ┌───────────────────┐    ┌────────────────┐
 │  sensor_readings  │    │   mqtt_logs    │
 ├───────────────────┤    ├────────────────┤
 │ PK id             │    │ PK id          │
 │ FK device_id      │    │ topic          │
 │ soil_moisture     │    │ direction      │
 │ temperature       │    │ payload        │
 │ humidity          │    │ FK device_id   │
 │ fuzzy_output      │    │ request_id     │
 │ battery_voltage   │    │ timestamp      │
 │ rssi              │    └────────────────┘
 │ timestamp         │
 └───────────────────┘


          ┌──────────────────┐
          │ system_settings  │
          ├──────────────────┤
          │ PK id            │
          │ setting_key      │
          │ setting_value    │
          │ updated_at       │
          └──────────────────┘
```
