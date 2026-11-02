USE irigasi_brmp;

-- Jumlah sprinkler mengikuti PRD Bagian 3.1.
INSERT INTO zones (id, label, sprinkler_count) VALUES
 (1,'V01',6),(2,'V02',7),(3,'V03',6),(4,'V04',5),(5,'V05',5),
 (6,'V06',7),(7,'V07',4),(8,'V08',4),(9,'V09',7),(10,'V10',6),
 (11,'V11',6),(12,'V12',8),(13,'V13',8);

INSERT INTO system_status (id, online, mode) VALUES (1, 0, 'auto');

INSERT INTO schedule_settings (first_time, second_time) VALUES ('08:00:00','16:00:00');

-- Akun dibuat lewat `npm run buat-user`, bukan di sini: password_hash
-- harus dihasilkan Argon2id dan tidak bisa ditulis langsung sebagai SQL.