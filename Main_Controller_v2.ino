// ============================================================================
// MAIN CONTROLLER v2 - Sistem Irigasi IoT BRMP
// Board   : Heltec WiFi LoRa 32 V3 (board #1)
// Library : ShiftRegister74HC595 (Timo Denk), LiquidCrystal I2C (Frank de Brabander),
//           RTClib (Adafruit), RadioLib (Jan Gromes)
// STATUS  : BELUM DIUJI DI PERANGKAT. Uji bertahap sesuai urutan wiring.
// ============================================================================

#include <Wire.h>
#include <string.h>
#include <LiquidCrystal_I2C.h>
#include <RTClib.h>
#include <ShiftRegister74HC595.h>
#include <RadioLib.h>

// ---------------------------------------------------------------------------
// PIN
// ---------------------------------------------------------------------------
#define SR_DATA_PIN    19   // 74HC595 modul DAT
#define SR_CLK_PIN     21   // 74HC595 modul CLK
#define SR_LATCH_PIN   26   // 74HC595 modul LTCH
#define I2C_SDA        33   // LCD + RTC
#define I2C_SCL        42   // LCD + RTC
#define BTN_LEFT       0
#define BTN_RIGHT      45
#define BTN_START      46
#define BTN_CANCEL     34
#define LED_PIN        35
#define BATT_ADC_PIN   2    // pembagi tegangan aki (lihat BATT_RATIO)

// ---------------------------------------------------------------------------
// KONFIGURASI (cek nilai ini sebelum dipakai di lapangan)
// ---------------------------------------------------------------------------
#define NUM_VALVE          13
#define RELAY_ACTIVE_LOW   0      // 1 jika modul relay aktif LOW (cek saat Test_02)
#define LORA_FREQ          915.0  // MHz, cek aturan frekuensi Indonesia
#define SENSOR_TIMEOUT_MS  (5UL * 60UL * 1000UL)
#define VALVE_MAX_SEC      1800   // batas keras 30 menit per jalur
#define MANUAL_SEC         300    // durasi siram manual (tombol START)
#define VALVE_GAP_MS       3000   // jeda antar jalur agar tekanan stabil
#define LOW_BATT_V         11.5   // di bawah ini penyiraman otomatis dibatalkan
#define BATT_RATIO         6.0    // pembagi 100k atas / 20k bawah, kalibrasi dengan multimeter
#define WATER_HOUR_1       8
#define WATER_HOUR_2       16
#define INVALID_VAL        (-999.0f)

// ---------------------------------------------------------------------------
// OBJEK HARDWARE
// ---------------------------------------------------------------------------
ShiftRegister74HC595<2> sr(SR_DATA_PIN, SR_CLK_PIN, SR_LATCH_PIN);  // 2 IC = 16 kanal
LiquidCrystal_I2C lcd(0x27, 20, 4);
RTC_DS3231 rtc;
SX1262 radio = new Module(8, 14, 12, 13);  // NSS, DIO1, RST, BUSY

volatile bool loraRxFlag = false;
void IRAM_ATTR onLoraRx() { loraRxFlag = true; }

bool rtcOk  = false;
bool loraOk = false;

// ---------------------------------------------------------------------------
// STATE SENSOR (dari sensor node via LoRa)
// ---------------------------------------------------------------------------
float soilMoisture = INVALID_VAL;
float soilTemp     = INVALID_VAL;
float airTemp      = INVALID_VAL;
float airHum       = INVALID_VAL;
unsigned long lastSensorMs = 0;
bool sensorSeen = false;

// ---------------------------------------------------------------------------
// STATE VALVE
// ---------------------------------------------------------------------------
uint16_t pendingSec[NUM_VALVE];      // 0 = tidak antre, >0 = durasi (detik)
int8_t   activeValve = -1;           // -1 = tidak ada valve aktif
unsigned long activeStartMs = 0;
uint16_t activeSec = 0;
unsigned long nextValveAllowedMs = 0;
bool     emergencyStop = false;

float batteryV = 0;
unsigned long lastBtn[4] = {0, 0, 0, 0};

// ---------------------------------------------------------------------------
// RELAY / SHIFT REGISTER
// ---------------------------------------------------------------------------
void relayWrite(uint8_t ch, bool on) {
  sr.set(ch, on ^ RELAY_ACTIVE_LOW);
}

void allValvesOff() {
  for (uint8_t i = 0; i < 16; i++) relayWrite(i, false);
}

// ---------------------------------------------------------------------------
// BATERAI
// ---------------------------------------------------------------------------
float readBattery() {
  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) sum += analogReadMilliVolts(BATT_ADC_PIN);
  float mv = sum / 16.0f;
  return (mv / 1000.0f) * BATT_RATIO;
}

// ---------------------------------------------------------------------------
// ANTRIAN DAN VALVE SEQUENSIAL (hanya 1 valve aktif sekaligus)
// ---------------------------------------------------------------------------
void enqueueValve(uint8_t v, uint16_t sec) {
  if (v >= NUM_VALVE) return;
  if ((int8_t)v == activeValve) {
    Serial.printf("Valve %d sedang aktif, permintaan diabaikan\n", v + 1);
    return;
  }
  pendingSec[v] = sec;
  Serial.printf("Valve %d masuk antrian (%d detik)\n", v + 1, sec);
}

void startValve(uint8_t v) {
  allValvesOff();
  relayWrite(v, true);
  activeValve = v;
  activeStartMs = millis();
  activeSec = pendingSec[v];
  if (activeSec > VALVE_MAX_SEC) activeSec = VALVE_MAX_SEC;
  Serial.printf("Valve %d ON selama %d detik\n", v + 1, activeSec);
}

void stopActiveValve() {
  if (activeValve < 0) return;
  relayWrite(activeValve, false);
  Serial.printf("Valve %d OFF\n", activeValve + 1);
  pendingSec[activeValve] = 0;
  activeValve = -1;
  nextValveAllowedMs = millis() + VALVE_GAP_MS;

  bool masihAntre = false;
  for (uint8_t i = 0; i < NUM_VALVE; i++) if (pendingSec[i] > 0) masihAntre = true;
  if (!masihAntre) Serial.println("Semua jalur V1-V13 selesai");
}

void valveScheduler() {
  if (emergencyStop) return;
  unsigned long now = millis();

  if (activeValve >= 0) {
    if (now - activeStartMs >= activeSec * 1000UL) stopActiveValve();
    return;
  }
  if (now < nextValveAllowedMs) return;

  for (uint8_t i = 0; i < NUM_VALVE; i++) {
    if (pendingSec[i] > 0) {
      startValve(i);
      return;
    }
  }
}

void cancelAll() {
  emergencyStop = true;
  for (uint8_t i = 0; i < NUM_VALVE; i++) pendingSec[i] = 0;
  allValvesOff();
  activeValve = -1;
  Serial.println("STOP: semua valve OFF, antrian dikosongkan");
}

// ---------------------------------------------------------------------------
// LOGIKA OTOMATIS (fuzzy sederhana, placeholder sampai kalibrasi lapangan)
// ---------------------------------------------------------------------------
float fuzzySeconds(float moisture, float temp) {
  if (moisture < -998) return 0;
  float sec;
  if (moisture < 40)       sec = 600;   // tanah kering: 10 menit
  else if (moisture < 60)  sec = 300;   // tanah sedang: 5 menit
  else                     return 0;    // tanah cukup lembap
  if (temp > -998 && temp > 32) sec *= 1.2f;  // suhu tinggi: tambah 20%
  return sec;
}

bool sensorFresh() {
  return sensorSeen && (millis() - lastSensorMs < SENSOR_TIMEOUT_MS);
}

void autoWater() {
  if (emergencyStop) {
    Serial.println("Auto: dibatalkan, sistem dalam STOP");
    return;
  }
  if (!sensorFresh()) {
    Serial.println("Auto: data sensor tidak segar, lewati");
    return;
  }
  if (batteryV < LOW_BATT_V) {
    Serial.printf("Auto: baterai %.2f V terlalu rendah, lewati\n", batteryV);
    return;
  }
  uint16_t sec = (uint16_t)fuzzySeconds(soilMoisture, airTemp);
  if (sec == 0) {
    Serial.println("Auto: kelembapan cukup, tidak disiram");
    return;
  }
  Serial.printf("Auto: siram semua jalur %d detik\n", sec);
  for (uint8_t i = 0; i < NUM_VALVE; i++) enqueueValve(i, sec);
}

void checkSchedule() {
  if (!rtcOk) return;
  DateTime now = rtc.now();
  static int lastRunKey = -1;
  int key = now.day() * 100 + now.hour();
  if (now.minute() == 0 &&
      (now.hour() == WATER_HOUR_1 || now.hour() == WATER_HOUR_2) &&
      key != lastRunKey) {
    lastRunKey = key;
    Serial.printf("Jadwal %02d:00 terpicu\n", now.hour());
    autoWater();
  }
}

// ---------------------------------------------------------------------------
// LoRa RX
// ---------------------------------------------------------------------------
// Format paket: SENSOR,kelembapanTanah,suhuUdara,humUdara,suhuTanah  (nilai -999 = tidak valid)
void parseSensorPacket(const String& s) {
  if (!s.startsWith("SENSOR,")) return;

  float v[4] = {INVALID_VAL, INVALID_VAL, INVALID_VAL, INVALID_VAL};
  int start = 7;
  for (int i = 0; i < 4; i++) {
    int comma = s.indexOf(',', start);
    String tok = (comma < 0) ? s.substring(start) : s.substring(start, comma);
    v[i] = tok.toFloat();
    if (comma < 0) break;
    start = comma + 1;
  }

  if (v[0] > -998) soilMoisture = v[0];
  if (v[1] > -998) airTemp      = v[1];
  if (v[2] > -998) airHum       = v[2];
  if (v[3] > -998) soilTemp     = v[3];

  lastSensorMs = millis();
  sensorSeen = true;
}

void handleLora() {
  if (!loraRxFlag) return;
  loraRxFlag = false;

  String s;
  if (radio.readData(s) == RADIOLIB_ERR_NONE) {
    Serial.printf("RX: %s | RSSI %.1f dBm\n", s.c_str(), radio.getRSSI());
    parseSensorPacket(s);
  } else {
    Serial.println("RX: paket rusak");
  }
  radio.startReceive();
}

// ---------------------------------------------------------------------------
// TOMBOL
// LEFT/RIGHT : pilih jalur manual
// START      : siram jalur terpilih selama MANUAL_SEC (juga menghapus STOP)
// CANCEL     : STOP, semua valve OFF dan antrian dikosongkan
// ---------------------------------------------------------------------------
bool pressed(uint8_t pin, uint8_t idx) {
  if (digitalRead(pin) == LOW && millis() - lastBtn[idx] > 250) {
    lastBtn[idx] = millis();
    return true;
  }
  return false;
}

bool sequenceBusy() {
  if (activeValve >= 0) return true;
  for (uint8_t i = 0; i < NUM_VALVE; i++) if (pendingSec[i] > 0) return true;
  return false;
}

// START: siram V1 sampai V13 berurutan, masing-masing MANUAL_SEC detik
void startFullSequence() {
  if (sequenceBusy()) {
    Serial.println("START diabaikan: urutan masih berjalan");
    return;
  }
  emergencyStop = false;
  Serial.println("START: siram V1 sampai V13 berurutan");
  for (uint8_t i = 0; i < NUM_VALVE; i++) enqueueValve(i, MANUAL_SEC);
}

void handleButtons() {
  if (pressed(BTN_START, 2))  startFullSequence();
  if (pressed(BTN_CANCEL, 3)) cancelAll();
}

// ---------------------------------------------------------------------------
// LCD 20x4
// ---------------------------------------------------------------------------
void lcdLine(uint8_t row, const char* text) {
  char buf[21];
  memset(buf, ' ', 20);
  buf[20] = 0;
  size_t n = strlen(text);
  if (n > 20) n = 20;
  memcpy(buf, text, n);
  lcd.setCursor(0, row);
  lcd.print(buf);
}

void updateLcd() {
  char b[24], a[8], t[8], u[8];

  // Baris 0: jam dan status LoRa
  if (rtcOk) {
    DateTime n = rtc.now();
    snprintf(b, sizeof(b), "%02d:%02d:%02d LR:%s",
             n.hour(), n.minute(), n.second(), loraOk ? "OK" : "--");
  } else {
    snprintf(b, sizeof(b), "RTC ERR  LR:%s", loraOk ? "OK" : "--");
  }
  lcdLine(0, b);

  // Baris 1: kelembapan dan suhu tanah (sensor RS485)
  if (soilMoisture < -998) strcpy(a, "--");
  else snprintf(a, sizeof(a), "%.0f%%", soilMoisture);
  if (soilTemp < -998) strcpy(t, "--");
  else snprintf(t, sizeof(t), "%.1fC", soilTemp);
  snprintf(b, sizeof(b), "Tanah:%-4s %s", a, t);
  lcdLine(1, b);

  // Baris 2: status valve, atau peringatan STOP
  if (emergencyStop) {
    snprintf(b, sizeof(b), "STOP: semua valve OFF");
  } else if (activeValve >= 0) {
    long sisa = (long)activeSec - (long)((millis() - activeStartMs) / 1000UL);
    if (sisa < 0) sisa = 0;
    snprintf(b, sizeof(b), "Siram V%02d  sisa %4lds", activeValve + 1, sisa);
  } else {
    int n = 0;
    for (uint8_t i = 0; i < NUM_VALVE; i++) if (pendingSec[i] > 0) n++;
    if (n > 0) snprintf(b, sizeof(b), "Antrian:%2d (jeda)", n);
    else       snprintf(b, sizeof(b), "Siap. START=V1-V13");
  }
  lcdLine(2, b);

  // Baris 3: suhu udara (DHT22) dan tegangan aki
  if (airTemp < -998) strcpy(u, "--");
  else snprintf(u, sizeof(u), "%.1fC", airTemp);
  snprintf(b, sizeof(b), "Udara:%-5s BAT%.1fV", u, batteryV);
  lcdLine(3, b);
}

// ---------------------------------------------------------------------------
// SETUP
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1500);
  Serial.println("\n=== MAIN CONTROLLER v2 ===");

  // Keamanan pertama: semua relay dalam kondisi OFF sebelum apa pun
  allValvesOff();

  pinMode(LED_PIN, OUTPUT);
  pinMode(BTN_LEFT, INPUT_PULLUP);
  pinMode(BTN_RIGHT, INPUT_PULLUP);
  pinMode(BTN_START, INPUT_PULLUP);
  pinMode(BTN_CANCEL, INPUT_PULLUP);
  analogSetPinAttenuation(BATT_ADC_PIN, ADC_11db);

  for (uint8_t i = 0; i < NUM_VALVE; i++) pendingSec[i] = 0;

  Wire.begin(I2C_SDA, I2C_SCL);
  lcd.init();
  lcd.backlight();
  lcdLine(0, "Booting...");

  rtcOk = rtc.begin();
  if (rtcOk) {
    if (rtc.lostPower()) rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
    Serial.println("RTC OK");
  } else {
    Serial.println("RTC TIDAK DITEMUKAN, penjadwalan nonaktif");
  }

  SPI.begin(9, 11, 10, 8);
  int st = radio.begin(LORA_FREQ, 125.0, 9, 7,
                       RADIOLIB_SX126X_SYNC_WORD_PRIVATE, 14, 8, 1.8);
  loraOk = (st == RADIOLIB_ERR_NONE);
  if (loraOk) {
    radio.setDio2AsRfSwitch(true);
    radio.setDio1Action(onLoraRx);
    radio.startReceive();
    Serial.println("LoRa OK, menunggu data sensor");
  } else {
    Serial.printf("LoRa GAGAL, kode %d (sistem tetap jalan tanpa sensor)\n", st);
  }

  soilMoisture = soilTemp = airTemp = airHum = INVALID_VAL;
  batteryV = readBattery();
  Serial.printf("Baterai: %.2f V\n", batteryV);

  delay(1000);
  lcd.clear();
}

// ---------------------------------------------------------------------------
// LOOP
// ---------------------------------------------------------------------------
void loop() {
  handleButtons();
  handleLora();
  checkSchedule();
  valveScheduler();

  static unsigned long lastLcd = 0;
  static unsigned long lastBatt = 0;

  if (millis() - lastBatt > 5000) {
    batteryV = readBattery();
    lastBatt = millis();
  }
  if (millis() - lastLcd > 500) {
    updateLcd();
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    lastLcd = millis();
  }
  delay(5);
}
