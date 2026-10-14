// ============================================================================
// SENSOR NODE v3 - Sistem Irigasi IoT BRMP
// Board   : Heltec WiFi LoRa 32 V3 (board #2)
// Library : DHT sensor library (Adafruit), ModbusMaster (Doc Walker),
//           RadioLib (Jan Gromes), U8g2 (olikraus). Preferences: bawaan ESP32.
// STATUS  : BELUM DIUJI DI PERANGKAT. Register Modbus WAJIB dicek dengan datasheet.
//
// KALIBRASI (lewat Serial Monitor 115200, set "Newline" di bawah jendela):
//   CAL DRY   : simpan nilai rata-rata sekarang sebagai KERING
//   CAL WET   : simpan nilai rata-rata sekarang sebagai BASAH
//   CAL SHOW  : tampilkan nilai mentah, titik kalibrasi, dan status
//   CAL RESET : hapus kalibrasi
// Nilai disimpan di flash, tetap ada setelah reboot.
// ============================================================================

#include <DHT.h>
#include <ModbusMaster.h>
#include <RadioLib.h>
#include <U8g2lib.h>
#include <Preferences.h>
#include <string.h>

// ---------------------------------------------------------------------------
// PIN
// ---------------------------------------------------------------------------
#define DHT_PIN         1
#define RS485_RX_PIN   3
#define RS485_TX_PIN   4
#define RS485_DE_RE   2
#define LED_PIN        35
#define VEXT_PIN       36
#define OLED_SDA       17
#define OLED_SCL       18
#define OLED_RST       21

// ---------------------------------------------------------------------------
// KONFIGURASI
// ---------------------------------------------------------------------------
#define DHT_TYPE          DHT22
#define MODBUS_ADDR       0x01
#define MODBUS_BAUD       4800      // coba 9600 jika tidak ada respons
#define SOIL_REG_START    0x0000    // VERIFIKASI dengan datasheet THCPH-S
#define LORA_FREQ         915.0     // harus sama dengan main controller
#define SAMPLE_MS         10000UL
#define TX_MS             15000UL
#define INVALID_VAL       (-999.0f)
#define RAW_BUF_N         5         // jumlah sampel untuk rata-rata kalibrasi
#define CAL_MIN_SAMPLES   3         // minimal sampel sebelum boleh simpan kalibrasi
#define CAL_MIN_SPAN      20        // selisih minimal kering dan basah (satuan raw)

// ---------------------------------------------------------------------------
// OBJEK
// ---------------------------------------------------------------------------
DHT dht(DHT_PIN, DHT_TYPE);
ModbusMaster node;
SX1262 radio = new Module(8, 14, 12, 13);
U8G2_SSD1306_128X64_NONAME_F_SW_I2C oled(U8G2_R0, OLED_SCL, OLED_SDA, OLED_RST);
Preferences prefs;

struct Reading {
  float soilM = INVALID_VAL;     // kelembapan tanah (%), hanya jika sudah kalibrasi
  float soilT = INVALID_VAL;     // suhu tanah (°C)
  float airT  = INVALID_VAL;     // suhu udara (°C)
  float airH  = INVALID_VAL;     // kelembapan udara (%)
  uint16_t soilRaw = 0;          // nilai mentah register kelembapan
  bool soilRawOk = false;
};
Reading rd;

uint16_t rawBuf[RAW_BUF_N];
uint8_t  rawCount = 0;
uint8_t  rawHead  = 0;

uint16_t calDry = 0, calWet = 0;
bool hasDry = false, hasWet = false;
bool calOk = false;

bool loraOk = false;
uint32_t txCount = 0;
uint32_t txFail = 0;
bool lastTxOk = false;

// ---------------------------------------------------------------------------
// RS485 DE/RE
// ---------------------------------------------------------------------------
void preTx()  { digitalWrite(RS485_DE_RE, HIGH); delayMicroseconds(100); }
void postTx() { delayMicroseconds(100); digitalWrite(RS485_DE_RE, LOW); }

// ---------------------------------------------------------------------------
// KALIBRASI: penyimpanan di flash
// ---------------------------------------------------------------------------
void loadCal() {
  prefs.begin("soilcal", true);
  hasDry = prefs.isKey("dry");
  hasWet = prefs.isKey("wet");
  if (hasDry) calDry = prefs.getUShort("dry");
  if (hasWet) calWet = prefs.getUShort("wet");
  prefs.end();

  int span = (int)calWet - (int)calDry;
  if (span < 0) span = -span;
  calOk = hasDry && hasWet && span >= CAL_MIN_SPAN;
}

void calSave(const char* key, uint16_t val) {
  prefs.begin("soilcal", false);
  prefs.putUShort(key, val);
  prefs.end();
  loadCal();
}

void calClear() {
  prefs.begin("soilcal", false);
  prefs.clear();
  prefs.end();
  loadCal();
}

// Konversi nilai mentah ke persen. Berlaku juga jika sensor membaca terbalik
// (nilai naik saat basah atau turun saat basah).
float rawToPercent(uint16_t raw) {
  float p = ((float)raw - (float)calDry) * 100.0f / ((float)calWet - (float)calDry);
  if (p < 0)   p = 0;
  if (p > 100) p = 100;
  return p;
}

// ---------------------------------------------------------------------------
// RATA-RATA NILAI MENTAH (untuk kalibrasi)
// ---------------------------------------------------------------------------
void pushRaw(uint16_t r) {
  rawBuf[rawHead] = r;
  rawHead = (rawHead + 1) % RAW_BUF_N;
  if (rawCount < RAW_BUF_N) rawCount++;
}

bool avgRaw(uint16_t &out) {
  if (rawCount < CAL_MIN_SAMPLES) return false;
  uint32_t s = 0;
  for (uint8_t i = 0; i < rawCount; i++) s += rawBuf[i];
  out = (uint16_t)(s / rawCount);
  return true;
}

// ---------------------------------------------------------------------------
// PERINTAH SERIAL
// ---------------------------------------------------------------------------
void handleCommand(String c) {
  c.trim();
  c.toUpperCase();

  if (c == "CAL DRY" || c == "CAL WET") {
    uint16_t avg;
    if (!avgRaw(avg)) {
      Serial.println("Data belum cukup. Tunggu sekitar 30 detik, lalu ulangi.");
      return;
    }
    bool dry = (c == "CAL DRY");
    calSave(dry ? "dry" : "wet", avg);
    Serial.printf("%s disimpan: raw=%u\n", dry ? "KERING" : "BASAH", avg);
    if (calOk) Serial.println("Kalibrasi AKTIF.");
    else if (hasDry && hasWet) Serial.printf("Selisih terlalu kecil (minimal %d). Ulangi titik yang kurang kontras.\n", CAL_MIN_SPAN);
    else Serial.println("Simpan juga titik lainnya (CAL DRY dan CAL WET).");

  } else if (c == "CAL SHOW") {
    Serial.printf("Nilai mentah sekarang : %u\n", rd.soilRaw);
    if (hasDry) Serial.printf("Titik kering          : %u\n", calDry);
    else        Serial.println("Titik kering          : belum diset");
    if (hasWet) Serial.printf("Titik basah           : %u\n", calWet);
    else        Serial.println("Titik basah           : belum diset");
    Serial.printf("Status                : %s\n", calOk ? "AKTIF" : "BELUM AKTIF");
    if (calOk && rd.soilRawOk) Serial.printf("Kelembapan sekarang   : %.1f%%\n", rawToPercent(rd.soilRaw));

  } else if (c == "CAL RESET") {
    calClear();
    Serial.println("Kalibrasi dihapus.");

  } else {
    Serial.println("Perintah: CAL DRY | CAL WET | CAL SHOW | CAL RESET");
  }
}

void checkSerial() {
  static String buf;
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n') {
      if (buf.length() > 0) handleCommand(buf);
      buf = "";
    } else if (ch != '\r') {
      buf += ch;
    }
  }
}

// ---------------------------------------------------------------------------
// BACA SENSOR
// ---------------------------------------------------------------------------
void readDht() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (isnan(t) || isnan(h)) {
    rd.airT = rd.airH = INVALID_VAL;
    Serial.println("DHT22: gagal baca");
    return;
  }
  rd.airT = t;
  rd.airH = h;
  Serial.printf("DHT22: T=%.1f C, H=%.1f %%\n", t, h);
}

void readSoil() {
  uint8_t res = node.readHoldingRegisters(SOIL_REG_START, 2);
  if (res != node.ku8MBSuccess) {
    rd.soilM = rd.soilT = INVALID_VAL;
    rd.soilRawOk = false;
    Serial.printf("Modbus gagal, kode 0x%02X\n", res);
    return;
  }

  uint16_t raw = node.getResponseBuffer(0);
  rd.soilRaw = raw;
  rd.soilRawOk = true;
  rd.soilT = node.getResponseBuffer(1) / 10.0f;
  pushRaw(raw);

  if (calOk) {
    rd.soilM = rawToPercent(raw);
    Serial.printf("Tanah: raw=%u lembap=%.1f%% suhu=%.1f\n", raw, rd.soilM, rd.soilT);
  } else {
    rd.soilM = INVALID_VAL;   // belum dikalibrasi: jangan kirim nilai yang menyesatkan
    Serial.printf("Tanah: raw=%u (BELUM KALIBRASI) suhu=%.1f\n", raw, rd.soilT);
  }
}

// ---------------------------------------------------------------------------
// KIRIM LoRa
// Format: SENSOR,kelembapanTanah,suhuUdara,humUdara,suhuTanah  (-999 = tidak valid)
// ---------------------------------------------------------------------------
void sendPacket() {
  if (!loraOk) return;

  char buf[96];
  snprintf(buf, sizeof(buf), "SENSOR,%.1f,%.1f,%.1f,%.1f",
           rd.soilM, rd.airT, rd.airH, rd.soilT);
  String msg = buf;

  int st = radio.transmit(msg);
  txCount++;
  if (st == RADIOLIB_ERR_NONE) {
    lastTxOk = true;
    Serial.printf("TX OK: %s\n", buf);
  } else {
    lastTxOk = false;
    txFail++;
    Serial.printf("TX GAGAL, kode %d\n", st);
  }
}

// ---------------------------------------------------------------------------
// OLED
// ---------------------------------------------------------------------------
void oledLine(uint8_t y, const char* text) {
  oled.drawStr(0, y, text);
}

void updateOled() {
  char b[32];
  oled.clearBuffer();
  oled.setFont(u8g2_font_6x12_tr);

  oledLine(12, calOk ? "SENSOR NODE  CAL:OK" : "SENSOR NODE  CAL:--");

  if (rd.soilM > -998) {
    snprintf(b, sizeof(b), "Tanah : %.1f%%  %.1fC", rd.soilM, rd.soilT);
  } else if (rd.soilRawOk) {
    snprintf(b, sizeof(b), "Tanah : raw %u", rd.soilRaw);
  } else {
    snprintf(b, sizeof(b), "Tanah : --");
  }
  oledLine(28, b);

  if (rd.airT < -998) snprintf(b, sizeof(b), "Udara : --");
  else snprintf(b, sizeof(b), "Udara : %.1fC  %.0f%%", rd.airT, rd.airH);
  oledLine(44, b);

  snprintf(b, sizeof(b), "TX:%lu gagal:%lu %s",
           (unsigned long)txCount, (unsigned long)txFail,
           loraOk ? (lastTxOk ? "OK" : "ERR") : "NOLORA");
  oledLine(60, b);

  oled.sendBuffer();
}

// ---------------------------------------------------------------------------
// SETUP
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1500);
  Serial.println("\n=== SENSOR NODE v3 ===");
  Serial.println("Perintah kalibrasi: CAL DRY | CAL WET | CAL SHOW | CAL RESET");

  pinMode(LED_PIN, OUTPUT);
  pinMode(RS485_DE_RE, OUTPUT);
  digitalWrite(RS485_DE_RE, LOW);

  loadCal();
  if (calOk) Serial.printf("Kalibrasi dimuat: kering=%u basah=%u\n", calDry, calWet);
  else       Serial.println("Belum ada kalibrasi. Jalankan CAL DRY dan CAL WET.");

  pinMode(VEXT_PIN, OUTPUT);
  digitalWrite(VEXT_PIN, LOW);
  delay(100);
  oled.begin();
  oled.clearBuffer();
  oled.setFont(u8g2_font_6x12_tr);
  oledLine(28, "Init...");
  oled.sendBuffer();

  dht.begin();

  Serial1.begin(MODBUS_BAUD, SERIAL_8N1, RS485_RX_PIN, RS485_TX_PIN);
  delay(300);
  node.begin(MODBUS_ADDR, Serial1);
  node.preTransmission(preTx);
  node.postTransmission(postTx);

  SPI.begin(9, 11, 10, 8);
  int st = radio.begin(LORA_FREQ, 125.0, 9, 7,
                       RADIOLIB_SX126X_SYNC_WORD_PRIVATE, 14, 8, 1.8);
  loraOk = (st == RADIOLIB_ERR_NONE);
  if (loraOk) {
    radio.setDio2AsRfSwitch(true);
    Serial.println("LoRa OK (mode TX)");
  } else {
    Serial.printf("LoRa GAGAL, kode %d\n", st);
  }

  delay(1500);
}

// ---------------------------------------------------------------------------
// LOOP
// ---------------------------------------------------------------------------
void loop() {
  static unsigned long lastSample = 0;
  static unsigned long lastTx = 0;
  static unsigned long lastOled = 0;
  unsigned long now = millis();

  checkSerial();

  if (now - lastSample >= SAMPLE_MS || lastSample == 0) {
    readDht();
    readSoil();
    lastSample = now;
  }

  if (now - lastTx >= TX_MS) {
    sendPacket();
    lastTx = now;
  }

  if (now - lastOled >= 1000) {
    updateOled();
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    lastOled = now;
  }

  delay(10);
}
