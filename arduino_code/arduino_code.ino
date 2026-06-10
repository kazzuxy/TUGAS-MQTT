#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ==========================================
// KONSOLIDASI CONFIG WIFI
// ==========================================
const char* WIFI_SSID = "p";
const char* WIFI_PASS = "15000000";

// ==========================================
// DHT SENSOR CONFIG
// Pin data sensor terhubung ke GPIO 4
// ==========================================
#define DHTPIN 4
#define DHTTYPE DHT22   // Ganti ke DHT11 jika menggunakan modul DHT11
DHT dht(DHTPIN, DHTTYPE);

// ==========================================
// AKTUATOR RELAY CONFIG (ACTIVE LOW)
// Relay Aktif = LOW (0v)
// Relay Padam = HIGH (3.3v / 5v)
// ==========================================
#define RELAY_ACTIVE_LOW true

const int relayPins[4] = {25, 26, 27, 14};
bool relayState[4] = {false, false, false, false};

// ==========================================
// PENAMAAN TOPIC METADATA (MULTIBROKER SYNC)
// ==========================================
const char* DEVICE_ID = "esp32-ways";
const char* BASE_TOPIC = "gusliyanza/iot-multibroker";

String topicSensor       = String(BASE_TOPIC) + "/sensor";
String topicRelayStatus  = String(BASE_TOPIC) + "/relay/status";
String topicDeviceStatus = String(BASE_TOPIC) + "/device/status";
String topicModeStatus   = String(BASE_TOPIC) + "/mode/status";

String topicRelaySet     = String(BASE_TOPIC) + "/relay/+/set";
String topicModeSet      = String(BASE_TOPIC) + "/mode/set";

// ==========================================
// DETAIL DATA INTEGRASI BROKER 1: CEDALO
// ==========================================
const char* BROKER1_HOST = "pf-w6qyp6uiqe8pz7u9s7cg.cedalo.cloud";
const int   BROKER1_PORT = 8883;
const char* BROKER1_USER = "bass-web-client";
const char* BROKER1_PASS = "AsuCeleng";

// ==========================================
// DETAIL DATA INTEGRASI BROKER 2: FLESPI
// Username berisi Flespi Token Anda
// ==========================================
const char* BROKER2_HOST = "mqtt.flespi.io";
const int   BROKER2_PORT = 8883;
const char* BROKER2_USER = "R7OQ3e49w4orexrpSQfcgrSgRe8Dj4A1FLcQEqCE7ahOfsLbQFaOTuQ3WxhJzZXU";
const char* BROKER2_PASS = "";

// ==========================================
// DETAIL DATA INTEGRASI BROKER 3: SHIFTR
// ==========================================
const char* BROKER3_HOST = "wayss.cloud.shiftr.io";
const int   BROKER3_PORT = 8883;
const char* BROKER3_USER = "wayss";
const char* BROKER3_PASS = "AsuCeleng";

// ==========================================
// INSTANSIASI CLIENT SECURE & PUBSUB
// ==========================================
WiFiClientSecure secureClient1;
WiFiClientSecure secureClient2;
WiFiClientSecure secureClient3;

PubSubClient mqtt1(secureClient1);
PubSubClient mqtt2(secureClient2);
PubSubClient mqtt3(secureClient3);

// ==========================================
// PELACAK WAKTU RUNTIME CARD MULTITASKING
// ==========================================
unsigned long lastSensorPublish = 0;
unsigned long lastReconnectTry = 0;

const unsigned long SENSOR_INTERVAL = 5000;      // Kirim data DHT per 5 Detik sekali
const unsigned long RECONNECT_INTERVAL = 5000;   // Coba sambung ulang per 5 Detik jika putus

// ==========================================
// HELPER METHOD DARI HARDWARE CHIP ESP32
// ==========================================
String getChipId() {
  uint64_t chipid = ESP.getEfuseMac();
  return String((uint32_t)(chipid & 0xFFFFFFFF), HEX);
}

void mqttLoopOnly() {
  mqtt1.loop();
  mqtt2.loop();
  mqtt3.loop();
}

void setRelay(int index, bool state) {
  if (index < 0 || index > 3) return;

  relayState[index] = state;

  if (RELAY_ACTIVE_LOW) {
    digitalWrite(relayPins[index], state ? LOW : HIGH);
  } else {
    digitalWrite(relayPins[index], state ? HIGH : LOW);
  }
}

void setAllRelays(bool state) {
  for (int i = 0; i < 4; i++) {
    setRelay(i, state);
  }
}

// Mengirimkan payload yang sama ke seluruh broker yang aktif
void publishToAll(String topic, String payload, bool retained = false) {
  if (mqtt1.connected()) mqtt1.publish(topic.c_str(), payload.c_str(), retained);
  if (mqtt2.connected()) mqtt2.publish(topic.c_str(), payload.c_str(), retained);
  if (mqtt3.connected()) mqtt3.publish(topic.c_str(), payload.c_str(), retained);
}

void publishRelayStatus() {
  StaticJsonDocument<256> doc;

  doc["device_id"] = DEVICE_ID;
  doc["relay1"] = relayState[0];
  doc["relay2"] = relayState[1];
  doc["relay3"] = relayState[2];
  doc["relay4"] = relayState[3];
  doc["relay_logic"] = "ACTIVE_LOW";

  String payload;
  serializeJson(doc, payload);

  publishToAll(topicRelayStatus, payload, true);
}

void publishDeviceStatus(const char* status) {
  StaticJsonDocument<128> doc;

  doc["device_id"] = DEVICE_ID;
  doc["status"] = status;
  doc["wifi_rssi"] = WiFi.RSSI();

  String payload;
  serializeJson(doc, payload);

  publishToAll(topicDeviceStatus, payload, true);
}

void publishSensorData() {
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Gagal membaca sensor DHT!");
    return;
  }

  StaticJsonDocument<256> doc;

  doc["device_id"] = DEVICE_ID;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["unit_temperature"] = "C";
  doc["unit_humidity"] = "%";

  String payload;
  serializeJson(doc, payload);

  publishToAll(topicSensor, payload, false);

  Serial.println("Publish data sensor ke Multi-Broker:");
  Serial.println(payload);
}

// ==========================================
// ANIMASI VARIATION LOGIC RUNNING
// ==========================================
void runLeftToRightMode() {
  Serial.println("Mode ANIMASI: LEFT_TO_RIGHT Berjalan...");

  publishToAll(topicModeStatus, "{\"mode\":\"LEFT_TO_RIGHT\",\"status\":\"running\"}", false);

  for (int repeat = 0; repeat < 3; repeat++) {
    for (int i = 0; i < 4; i++) {
      setAllRelays(false);
      setRelay(i, true);
      publishRelayStatus();

      unsigned long startDelay = millis();
      while (millis() - startDelay < 400) {
        mqttLoopOnly();
        delay(10);
      }
    }
  }

  setAllRelays(false);
  publishRelayStatus();
  publishToAll(topicModeStatus, "{\"mode\":\"LEFT_TO_RIGHT\",\"status\":\"finished\"}", false);
}

void runStrobeMode() {
  Serial.println("Mode ANIMASI: STROBE Berjalan...");

  publishToAll(topicModeStatus, "{\"mode\":\"STROBE\",\"status\":\"running\"}", false);

  for (int i = 0; i < 8; i++) {
    setAllRelays(true);
    publishRelayStatus();

    unsigned long startOn = millis();
    while (millis() - startOn < 300) {
      mqttLoopOnly();
      delay(10);
    }

    setAllRelays(false);
    publishRelayStatus();

    unsigned long startOff = millis();
    while (millis() - startOff < 300) {
      mqttLoopOnly();
      delay(10);
    }
  }

  publishToAll(topicModeStatus, "{\"mode\":\"STROBE\",\"status\":\"finished\"}", false);
}

// ==========================================
// PENERIMA DAN PEMROSES PESAN INCOMING MQTT
// ==========================================
void handleMqttMessage(String brokerName, char* topic, byte* payload, unsigned int length) {
  String topicStr = String(topic);
  String message = "";

  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  message.trim();

  Serial.println("⚡================================");
  Serial.println("Broker Masuk  : " + brokerName);
  Serial.println("Topic Target  : " + topicStr);
  Serial.println("Isi Payload   : " + message);
  Serial.println("==================================");

  // MEMPROSES VARIATION MODE COMMAND
  if (topicStr.endsWith("/mode/set")) {
    String mode = message;

    StaticJsonDocument<128> doc;
    DeserializationError error = deserializeJson(doc, message);

    if (!error && doc["mode"]) {
      mode = doc["mode"].as<String>();
    }

    mode.toUpperCase();

    if (mode == "STROBE") {
      runStrobeMode();
    } else if (mode == "LEFT_TO_RIGHT" || mode == "LEFT_RIGHT") {
      runLeftToRightMode();
    }

    return;
  }

  // MEMPROSES MANUAL RELAY KONTROL
  if (topicStr.indexOf("/relay/") >= 0 && topicStr.endsWith("/set")) {
    String stateCommand = message;
    String target = "";

    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, message);

    if (!error) {
      if (doc["state"]) {
        stateCommand = doc["state"].as<String>();
      }
      if (doc["target"]) {
        target = doc["target"].as<String>();
      }
    }

    stateCommand.toUpperCase();

    bool targetState = false;

    if (stateCommand == "ON") {
      targetState = true;
    } else if (stateCommand == "OFF") {
      targetState = false;
    } else {
      Serial.println("Perintah relay tidak valid!");
      return;
    }

    if (topicStr.indexOf("/relay/all/set") >= 0 || target == "all") {
      setAllRelays(targetState);
    } else if (topicStr.indexOf("/relay/1/set") >= 0 || target == "relay1") {
      setRelay(0, targetState);
    } else if (topicStr.indexOf("/relay/2/set") >= 0 || target == "relay2") {
      setRelay(1, targetState);
    } else if (topicStr.indexOf("/relay/3/set") >= 0 || target == "relay3") {
      setRelay(2, targetState);
    } else if (topicStr.indexOf("/relay/4/set") >= 0 || target == "relay4") {
      setRelay(3, targetState);
    }

    publishRelayStatus();
  }
}

// Callback Listener Masing-masing Broker
void callbackBroker1(char* topic, byte* payload, unsigned int length) {
  handleMqttMessage("Cedalo", topic, payload, length);
}

void callbackBroker2(char* topic, byte* payload, unsigned int length) {
  handleMqttMessage("Flespi", topic, payload, length);
}

void callbackBroker3(char* topic, byte* payload, unsigned int length) {
  handleMqttMessage("Shiftr", topic, payload, length);
}

// ==========================================
// MQTT PROTOCOL SETUP & CONNECT METHODS
// ==========================================
void subscribeTopics(PubSubClient& client) {
  client.subscribe(topicRelaySet.c_str());
  client.subscribe(topicModeSet.c_str());
}

bool connectBroker(
  PubSubClient& client,
  const char* brokerLabel,
  const char* username,
  const char* password,
  String clientId
) {
  if (client.connected()) {
    return true;
  }

  Serial.print("Mencoba hubung ke ");
  Serial.println(brokerLabel);

  bool connected;

  if (strlen(username) > 0) {
    connected = client.connect(
      clientId.c_str(),
      username,
      password,
      topicDeviceStatus.c_str(),
      1,
      true,
      "{\"status\":\"offline\"}"
    );
  } else {
    connected = client.connect(
      clientId.c_str(),
      topicDeviceStatus.c_str(),
      1,
      true,
      "{\"status\":\"offline\"}"
    );
  }

  if (connected) {
    Serial.print("✓ ");
    Serial.print(brokerLabel);
    Serial.println(" ONLINE!");

    subscribeTopics(client);
    publishDeviceStatus("online");
    publishRelayStatus();

    return true;
  } else {
    Serial.print("✗ ");
    Serial.print(brokerLabel);
    Serial.print(" GAGAL, kode_error=");
    Serial.println(client.state());

    return false;
  }
}

void reconnectAllMqtt() {
  if (millis() - lastReconnectTry < RECONNECT_INTERVAL) {
    return;
  }

  lastReconnectTry = millis();

  String chipId = getChipId();

  connectBroker(
    mqtt1,
    "Cedalo",
    BROKER1_USER,
    BROKER1_PASS,
    "gzza_esp32_cedalo_" + chipId
  );

  connectBroker(
    mqtt2,
    "Flespi",
    BROKER2_USER,
    BROKER2_PASS,
    "gzza_esp32_flespi_" + chipId
  );

  connectBroker(
    mqtt3,
    "Shiftr",
    BROKER3_USER,
    BROKER3_PASS,
    "gzza_esp32_shiftr_" + chipId
  );
}

// ==========================================
// INITIAL SETUP INVENT
// ==========================================
void setup() {
  Serial.begin(115200);

  dht.begin();

  for (int i = 0; i < 4; i++) {
    pinMode(relayPins[i], OUTPUT);
    setRelay(i, false);
  }

  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("✓ WiFi Terhubung!");
  Serial.print("IP Address ESP32: ");
  Serial.println(WiFi.localIP());

  // Mematikan verifikasi sertifikat root CA (instant out-of-the-box trial)
  secureClient1.setInsecure();
  secureClient2.setInsecure();
  secureClient3.setInsecure();

  mqtt1.setServer(BROKER1_HOST, BROKER1_PORT);
  mqtt2.setServer(BROKER2_HOST, BROKER2_PORT);
  mqtt3.setServer(BROKER3_HOST, BROKER3_PORT);

  mqtt1.setCallback(callbackBroker1);
  mqtt2.setCallback(callbackBroker2);
  mqtt3.setCallback(callbackBroker3);

  mqtt1.setBufferSize(512);
  mqtt2.setBufferSize(512);
  mqtt3.setBufferSize(512);

  reconnectAllMqtt();
}

// ==========================================
// MAIN LOOP ENGINE
// ==========================================
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi terputus! Menyambung ulang...");
    WiFi.reconnect();
    delay(1000);
    return;
  }

  reconnectAllMqtt();

  mqtt1.loop();
  mqtt2.loop();
  mqtt3.loop();

  // Multi-tasking data sensor teratur tanpa delay blocking
  if (millis() - lastSensorPublish >= SENSOR_INTERVAL) {
    lastSensorPublish = millis();
    publishSensorData();
    publishRelayStatus();
  }
}
