-- Skema basis data Sistem Irigasi IoT BRMP
-- MySQL 9.7 LTS (juga jalan di 8.4 LTS). Jangan pakai MySQL 8.0: habis dukungan April 2026.

CREATE DATABASE IF NOT EXISTS irigasi_brmp
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE irigasi_brmp;

CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(100) NOT NULL,
  role          ENUM('admin','viewer') NOT NULL DEFAULT 'viewer',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE zones (
  id              TINYINT UNSIGNED PRIMARY KEY,
  label           VARCHAR(10) NOT NULL UNIQUE,
  sprinkler_count SMALLINT UNSIGNED NULL,
  notes           VARCHAR(255) NULL
) ENGINE=InnoDB;

-- Menyimpan riwayat: satu baris per perubahan, lengkap dengan pengubahnya.
-- Yang berlaku adalah baris dengan updated_at terbesar.
CREATE TABLE schedule_settings (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_time  TIME NOT NULL,
  second_time TIME NOT NULL,
  updated_by  INT UNSIGNED NULL,
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_sched_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_sched_beda CHECK (first_time <> second_time),
  INDEX idx_sched_waktu (updated_at)
) ENGINE=InnoDB;

CREATE TABLE sensor_readings (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  node_id       VARCHAR(20)  NOT NULL DEFAULT 'node-1',
  soil_moisture DECIMAL(5,2) NULL,
  soil_temp     DECIMAL(5,2) NULL,
  air_temp      DECIMAL(5,2) NULL,
  air_humidity  DECIMAL(5,2) NULL,
  ph            DECIMAL(4,2) NULL,
  ec            DECIMAL(6,3) NULL,
  received_at   DATETIME(3)  NOT NULL,
  INDEX idx_sensor_waktu (received_at)
) ENGINE=InnoDB;

CREATE TABLE decisions (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  decided_at    DATETIME(3) NOT NULL,
  trigger_type  ENUM('schedule','manual') NOT NULL,
  result        ENUM('siram','tidak')     NOT NULL,
  duration_min  SMALLINT UNSIGNED NULL,
  soil_moisture DECIMAL(5,2) NULL,
  air_temp      DECIMAL(5,2) NULL,
  air_humidity  DECIMAL(5,2) NULL,
  note          VARCHAR(255) NULL,
  INDEX idx_dec_waktu (decided_at)
) ENGINE=InnoDB;

CREATE TABLE control_commands (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NULL,
  type          ENUM('start','stop','cancel_queue','set_mode','set_schedule') NOT NULL,
  zone_id       TINYINT UNSIGNED NULL,
  duration_min  SMALLINT UNSIGNED NULL,
  mode          ENUM('auto','manual') NULL,
  queue_id      VARCHAR(36) NULL,
  payload       JSON NULL,
  outcome       ENUM('queued','sent','running','done','rejected','cancelled')
                NOT NULL DEFAULT 'queued',
  reject_reason VARCHAR(255) NULL,
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_cmd_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_cmd_zone FOREIGN KEY (zone_id) REFERENCES zones(id),
  UNIQUE KEY uq_queue_id (queue_id),
  INDEX idx_cmd_antre (outcome, created_at)
) ENGINE=InnoDB;

CREATE TABLE watering_events (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  zone_id     TINYINT UNSIGNED NOT NULL,
  decision_id BIGINT UNSIGNED NULL,
  command_id  BIGINT UNSIGNED NULL,
  source      ENUM('auto','manual') NOT NULL,
  queue_id    VARCHAR(36) NULL,
  started_at  DATETIME(3) NOT NULL,
  ended_at    DATETIME(3) NULL,
  planned_sec INT UNSIGNED NOT NULL,
  actual_sec  INT UNSIGNED NULL,
  result      ENUM('berjalan','selesai','dihentikan','error') NOT NULL DEFAULT 'berjalan',
  CONSTRAINT fk_we_zone     FOREIGN KEY (zone_id)     REFERENCES zones(id),
  CONSTRAINT fk_we_decision FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE SET NULL,
  CONSTRAINT fk_we_command  FOREIGN KEY (command_id)  REFERENCES control_commands(id) ON DELETE SET NULL,
  INDEX idx_we_mulai (started_at),
  INDEX idx_we_hasil (result)
) ENGINE=InnoDB;

-- zone_id boleh NULL: "Sensor timeout" dan "WiFi terputus" tidak terkait valve mana pun.
CREATE TABLE error_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  occurred_at DATETIME(3) NOT NULL,
  severity    ENUM('info','warning','error','critical') NOT NULL DEFAULT 'error',
  code        VARCHAR(40)  NULL,
  message     VARCHAR(255) NOT NULL,
  source      VARCHAR(40)  NULL,
  zone_id     TINYINT UNSIGNED NULL,
  CONSTRAINT fk_err_zone FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE SET NULL,
  INDEX idx_err_waktu (occurred_at)
) ENGINE=InnoDB;

-- Satu baris saja, id selalu 1. Hanya jalur MQTT yang boleh mengubahnya.
CREATE TABLE system_status (
  id            TINYINT UNSIGNED PRIMARY KEY,
  online        TINYINT(1) NOT NULL DEFAULT 0,
  mode          ENUM('auto','manual','error') NOT NULL DEFAULT 'auto',
  next_schedule TIME NULL,
  uptime_sec    INT UNSIGNED NULL,
  wifi_rssi     SMALLINT NULL,
  last_error    VARCHAR(255) NULL,
  updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_satu_baris CHECK (id = 1)
) ENGINE=InnoDB;