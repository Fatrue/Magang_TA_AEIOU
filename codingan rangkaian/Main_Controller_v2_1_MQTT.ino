// ============================================================================
// MAIN CONTROLLER v2.1 - Sistem Irigasi IoT BRMP
// Board   : Heltec WiFi LoRa 32 V3 (board #1)
// Perubahan dari v2: WiFi, MQTT over TLS ke Mosquitto di server, perintah
//                    dari server dengan balasan (ack), data sensor dan status.
// Library : ShiftRegister74HC595 (Timo Denk), LiquidCrystal I2C (Frank de Brabander),
//           RTClib (Adafruit), RadioLib (Jan Gromes), PubSubClient (Nick O'Leary),
//           ArduinoJson v7 (Benoit Blanchon)
// STATUS  : BELUM DIUJI DI PERANGKAT. Uji bertahap sesuai urutan di bawah.
// ============================================================================

#include <Wire.h>
#include <string.h>
#include <sys/time.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <LiquidCrystal_I2C.h>
#include <RTClib.h>
#include <ShiftRegister74HC595.h>
#include <RadioLib.h>

// ---------------------------------------------------------------------------
// KONFIGURASI JARINGAN (WAJIB DIISI SEBELUM UPLOAD)
// ---------------------------------------------------------------------------
#define WIFI_SSID      "GANTI_SSID_WIFI"
#define WIFI_PASS      "GANTI_PASSWORD_WIFI"

#define MQTT_HOST      "192.168.101.234"   // tes di LAN. Untuk lapangan: IP publik atau alamat VPN
#define MQTT_PORT      8883
#define MQTT_USER      "esp_brmp01"
#define MQTT_PASS      "GANTI_PASSWORD_ESP32"
#define MQTT_CLIENT_ID "esp-brmp01-main"

#define TB             "irigasi/brmp01"    // prefix semua topik
#define FW_VERSION     "2.1.0"

// Isi dengan output `cat /home/brmp/irigasi/mosquitto/certs/ca.crt` dari server.
// Hanya sertifikat CA (publik). JANGAN pernah memasukkan ca.key atau server.key.
static const char CA_CERT[] = R"EOF(-----BEGIN CERTIFICATE-----
GANTI_ISI_CA_CRT_DARI_SERVER
-----END CERTIFICATE-----
)EOF";

// ---------------------------------------------------------------------------
// PIN (sama dengan v2)
// ---------------------------------------------------------------------------
#define SR_DATA_PIN    19
#define SR_CLK_PIN     21
#define SR_LATCH_PIN   26
#define I2C_SDA        33
#define I2C_SCL        42
#define BTN_START      46
#define BTN_CANCEL     34
#define LED_PIN        35
#define BATT_ADC_PIN   2

// ---------------------------------------------------------------------------
// KONFIGURASI SISTEM (sama dengan v2)
// ---------------------------------------------------------------------------
#define NUM_VALVE          13
#define RELAY_ACTIVE_LOW   0      // 1 jika modul relay aktif LOW
#define LORA_FREQ          915.0  // MHz, cek aturan frekuensi Indonesia
#define SENSOR_TIMEOUT_MS  (5UL * 60UL * 1000UL)
#define VALVE_MAX_SEC      1800
#define MANUAL_SEC         300
#define VALVE_GAP_MS       3000
#define LOW_BATT_V         11.5
#define BATT_RATIO         6.0
#define WATER_HOUR_1       8
#define WATER_HOUR_2       16
#define INVALID_VAL        (-999.0f)

#define SENSOR_PUB_MS     60000UL   // data sensor ke server tiap 60 detik
#define STATUS_PUB_MS     30000UL   // status (retained) tiap 30 detik

// ---------------------------------------------------------------------------
// OBJEK HARDWARE & JARINGAN
// ---------------------------------------------------------------------------
ShiftRegister74HC595<2> sr(SR_DATA_PIN, SR_CLK_PIN, SR_LATCH_PIN);
LiquidCrystal_I2C lcd(0x27, 20, 4);
RTC_DS3231 rtc;
SX1262 radio = new Module(8, 14, 12, 13);

WiFiClientSecure tlsClient;
PubSubClient mqtt(tlsClient);

volatile bool loraRxFlag = false;
void IRAM_ATTR onLoraRx() { loraRxFlag = true; }

bool rtcOk  = false;
bool loraOk = false;
bool mqttEnabled = true;
float lastRssi = 0;

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
uint16_t pendingSec[NUM_VALVE];
int8_t   activeValve = -1;
unsigned long activeStartMs = 0;
uint16_t activeSec = 0;
unsigned long nextValveAllowedMs = 0;
bool emergencyStop = false;

float batteryV = 0;
unsigned long lastBtn[2] = {0, 0};

// Timer jaringan
unsigned long lastWifiTry = 0;
unsigned long lastMqttTry = 0;
unsigned long lastSensorPub = 0;
unsigned long lastStatusPub = 0;

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
// WAKTU
// ---------------------------------------------------------------------------
uint32_t unixNow() {
  return (uint32_t)time(nullptr);
}

// TLS memeriksa masa berlaku sertifikat, jadi jam sistem harus benar sebelum
// koneksi MQTT. Jam diambil dari RTC DS3231 saat boot.
void setClockFromRtc() {
  if (!rtcOk) return;
  DateTime n = rtc.now();
  struct timeval tv;
  tv.tv_sec = n.unixtime();
  tv.tv_usec = 0;
  settimeofday(&tv, nullptr);
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
// ANTRIAN DAN VALVE SEQUENSIAL (sama dengan v2)
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

bool sequenceBusy() {
  if (activeValve >= 0) return true;
  for (uint8_t i = 0; i < NUM_VALVE; i++) if (pendingSec[i] > 0) return true;
  return false;
}

// START: V1 sampai V13 berurutan, masing-masing MANUAL_SEC detik
void startFullSequence() {
  if (sequenceBusy()) {
    Serial.println("START diabaikan: urutan masih berjalan");
    return;
  }
  emergencyStop = false;
  Serial.println("START: siram V1 sampai V13 berurutan");
  for (uint8_t i = 0; i < NUM_VALVE; i++) enqueueValve(i, MANUAL_SEC);
}

// ---------------------------------------------------------------------------
// LOGIKA OTOMATIS (fuzzy sederhana, sama dengan v2)
// ---------------------------------------------------------------------------
float fuzzySeconds(float moisture, float temp) {
  if (moisture < -998) return 0;
  float sec;
  if (moisture < 40)       sec = 600;
  else if (moisture < 60)  sec = 300;
  else                     return 0;
  if (temp > -998 && temp > 32) sec *= 1.2f;
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
// LoRa RX (dari sensor node)
// Format: SENSOR,kelembapanTanah,suhuUdara,humUdara,suhuTanah  (-999 = tidak valid)
// ---------------------------------------------------------------------------
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
    lastRssi = radio.getRSSI();
    Serial.printf("RX: %s | RSSI %.1f dBm\n", s.c_str(), lastRssi);
    parseSensorPacket(s);
  } else {
    Serial.println("RX: paket rusak");
  }
  radio.startReceive();
}

// ---------------------------------------------------------------------------
// MQTT: publish
// ---------------------------------------------------------------------------
void setNumOrNull(JsonDocument& d, const char* key, float v) {
  if (v < -998) d[key] = nullptr;
  else d[key] = v;
}

void publishAck(const char* id, bool accepted, const char* reason) {
  JsonDocument d;
  d["id"] = id;
  d["result"] = accepted ? "accepted" : "rejected";
  if (!accepted) d["reason"] = reason;
  char buf[160];
  serializeJson(d, buf, sizeof(buf));
  mqtt.publish(TB "/ack", buf, false);
}

void publishStatus() {
  if (!mqtt.connected()) return;

  JsonDocument d;
  d["ts"] = unixNow();
  d["online"] = true;
  d["mode"] = "auto";
  d["emergency_stop"] = emergencyStop;
  d["active_valve"] = (activeValve >= 0) ? activeValve + 1 : 0;

  long rem = 0;
  if (activeValve >= 0) {
    rem = (long)activeSec - (long)((millis() - activeStartMs) / 1000UL);
    if (rem < 0) rem = 0;
  }
  d["valve_remaining_s"] = rem;

  JsonArray q = d["queue"].to<JsonArray>();
  for (uint8_t i = 0; i < NUM_VALVE; i++) {
    if (pendingSec[i] > 0 && (int8_t)i != activeValve) q.add(i + 1);
  }

  d["batt_v"] = batteryV;
  d["lora_ok"] = loraOk;
  d["sensor_fresh"] = sensorFresh();
  d["fw"] = FW_VERSION;

  char buf[512];
  serializeJson(d, buf, sizeof(buf));
  mqtt.publish(TB "/status", buf, true);
}

void publishSensor() {
  if (!mqtt.connected()) return;

  JsonDocument d;
  d["ts"] = unixNow();
  setNumOrNull(d, "soil_moisture", soilMoisture);
  setNumOrNull(d, "soil_temp", soilTemp);
  setNumOrNull(d, "air_temp", airTemp);
  setNumOrNull(d, "air_hum", airHum);
  d["rssi"] = lastRssi;
  d["batt_v"] = batteryV;

  char buf[256];
  serializeJson(d, buf, sizeof(buf));
  mqtt.publish(TB "/sensor", buf, false);
}

// ---------------------------------------------------------------------------
// MQTT: perintah dari server
// Format: {"id":"...","type":"START_SEQUENCE|STOP|MANUAL_VALVE","valve":3,"sec":300}
// ---------------------------------------------------------------------------
void handleCommand(JsonDocument& doc) {
  const char* id = doc["id"] | "";
  const char* type = doc["type"] | "";

  if (strcmp(type, "START_SEQUENCE") == 0) {
    if (sequenceBusy()) {
      publishAck(id, false, "sequence_busy");
    } else {
      startFullSequence();
      publishAck(id, true, "");
    }

  } else if (strcmp(type, "STOP") == 0) {
    cancelAll();
    publishAck(id, true, "");

  } else if (strcmp(type, "MANUAL_VALVE") == 0) {
    int valve = doc["valve"] | 0;
    int sec   = doc["sec"] | 0;
    if (valve < 1 || valve > NUM_VALVE || sec < 1 || sec > VALVE_MAX_SEC) {
      publishAck(id, false, "invalid_args");
    } else if (sequenceBusy()) {
      publishAck(id, false, "sequence_busy");
    } else {
      emergencyStop = false;
      enqueueValve(valve - 1, sec);
      publishAck(id, true, "");
    }

  } else {
    publishAck(id, false, "unknown_type");
  }

  publishStatus();
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  if (strcmp(topic, TB "/cmd") != 0) return;

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, (const char*)payload, length);
  if (err) {
    Serial.println("cmd: JSON tidak valid, diabaikan");
    return;
  }
  Serial.printf("cmd diterima: %s\n", doc["type"] | "?");
  handleCommand(doc);
}

// ---------------------------------------------------------------------------
// KONEKSI WIFI & MQTT (tidak memblokir loop)
// ---------------------------------------------------------------------------
void ensureWifi() {
  static bool wasUp = false;
  bool up = (WiFi.status() == WL_CONNECTED);

  if (up && !wasUp) {
    Serial.printf("WiFi tersambung, IP %s\n", WiFi.localIP().toString().c_str());
  }
  wasUp = up;

  if (up) return;
  if (millis() - lastWifiTry < 15000) return;
  lastWifiTry = millis();
  Serial.println("WiFi: menyambung ulang...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
}

void ensureMqtt() {
  if (!mqttEnabled || mqtt.connected()) return;
  if (WiFi.status() != WL_CONNECTED) return;
  if (millis() - lastMqttTry < 5000) return;
  lastMqttTry = millis();

  Serial.print("MQTT: menghubungkan... ");
  bool ok = mqtt.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASS,
                         TB "/lwt", 1, true, "offline");
  if (!ok) {
    Serial.printf("gagal, state=%d\n", mqtt.state());
    return;
  }

  Serial.println("OK");
  mqtt.subscribe(TB "/cmd", 1);
  mqtt.publish(TB "/lwt", "online", true);
  publishStatus();
  lastStatusPub = millis();
}

// ---------------------------------------------------------------------------
// TOMBOL (START dan CANCEL, sama dengan v2)
// ---------------------------------------------------------------------------
bool pressed(uint8_t pin, uint8_t idx) {
  if (digitalRead(pin) == LOW && millis() - lastBtn[idx] > 250) {
    lastBtn[idx] = millis();
    return true;
  }
  return false;
}

void handleButtons() {
  if (pressed(BTN_START, 0))  startFullSequence();
  if (pressed(BTN_CANCEL, 1)) cancelAll();
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

  // Baris 0: jam, status LoRa (L) dan MQTT (M)
  if (rtcOk) {
    DateTime n = rtc.now();
    snprintf(b, sizeof(b), "%02d:%02d:%02d L:%s M:%s",
             n.hour(), n.minute(), n.second(),
             loraOk ? "OK" : "--", mqtt.connected() ? "OK" : "--");
  } else {
    snprintf(b, sizeof(b), "RTC ERR L:%s M:%s",
             loraOk ? "OK" : "--", mqtt.connected() ? "OK" : "--");
  }
  lcdLine(0, b);

  // Baris 1: kelembapan dan suhu tanah
  if (soilMoisture < -998) strcpy(a, "--");
  else snprintf(a, sizeof(a), "%.0f%%", soilMoisture);
  if (soilTemp < -998) strcpy(t, "--");
  else snprintf(t, sizeof(t), "%.1fC", soilTemp);
  snprintf(b, sizeof(b), "Tanah:%-4s %s", a, t);
  lcdLine(1, b);

  // Baris 2: status valve, STOP, atau antrean
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

  // Baris 3: suhu udara dan tegangan aki
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
  Serial.println("\n=== MAIN CONTROLLER v2.1 ===");

  // Keamanan pertama: semua relay OFF sebelum apa pun
  allValvesOff();

  pinMode(LED_PIN, OUTPUT);
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
    setClockFromRtc();
    Serial.println("RTC OK, jam sistem disetel dari RTC");
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
    Serial.println("LoRa OK");
  } else {
    Serial.printf("LoRa GAGAL, kode %d\n", st);
  }

  // WiFi dan MQTT
  if (strstr(CA_CERT, "GANTI")) {
    mqttEnabled = false;
    Serial.println("PERINGATAN: CA_CERT belum diisi. MQTT dinonaktifkan.");
  }
  if (strstr(WIFI_SSID, "GANTI")) {
    Serial.println("PERINGATAN: WIFI_SSID belum diisi. WiFi tidak dimulai.");
  } else {
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    lastWifiTry = millis();
  }

  tlsClient.setCACert(CA_CERT);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setBufferSize(768);
  mqtt.setKeepAlive(30);

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

  ensureWifi();
  ensureMqtt();
  if (mqtt.connected()) mqtt.loop();

  unsigned long now = millis();
  if (mqtt.connected()) {
    if (now - lastSensorPub >= SENSOR_PUB_MS) {
      publishSensor();
      lastSensorPub = now;
    }
    if (now - lastStatusPub >= STATUS_PUB_MS) {
      publishStatus();
      lastStatusPub = now;
    }
  }

  static unsigned long lastLcd = 0;
  static unsigned long lastBatt = 0;

  if (now - lastBatt > 5000) {
    batteryV = readBattery();
    lastBatt = now;
  }
  if (now - lastLcd > 500) {
    updateLcd();
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    lastLcd = now;
  }

  delay(5);
}
