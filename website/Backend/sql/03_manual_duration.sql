-- Jalankan hanya pada database salinan/instalasi yang memakai versi baru.
-- Menyimpan 0.5 menit (30 detik) dan custom dengan ketelitian satu detik.
USE irigasi_brmp;
ALTER TABLE control_commands MODIFY duration_min DECIMAL(10,6) UNSIGNED NULL;
