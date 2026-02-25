/**
 * =======================================================
 *  LTESISTEM -- ESP32 PIR Simulation Node
 * =======================================================
 *
 *  Flujo de arranque:
 *  1. Conectar WiFi
 *  2. HTTPS POST /api/auth/device-register (login o auto-registro)
 *  3. Guardar JWT
 *  4. Conectar WSS Socket.IO (JWT en query param + header)
 *  5. Emitir device:register -> recibir config del backend
 *  6. Loop: leer Serial (1/0) -> emitir sensor PIR
 *
 *  CONFIGURACION INICIAL: modificar la seccion debajo
 * =======================================================
 */

#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

// =======================================================
//  CONFIGURACION -- MODIFICAR AQUI
// =======================================================

// -- Red WiFi --
const char *WIFI_SSID = "Familia Arias Alfonsos";
const char *WIFI_PASSWORD = "524185650";

// -- Backend (HTTPS) --
const char *SERVER_HOST = "192.168.0.106";
const int SERVER_PORT = 5000;

// URL base construida en setup()
String API_BASE;

// -- Contrasena por defecto de dispositivos --
const char *DEVICE_PASSWORD = "ltesistem-device-2025";

// -- Identidad del dispositivo --
String DEVICE_ID = "";   // Se genera en setup() desde la MAC
String DEVICE_NAME = ""; // Personalizar o dejar vacio

// -- Tipo y red --
const char *DEVICE_TYPE = "sensor";
const char *NETWORK_TYPE = "wifi";
const bool HAS_GPS = false;

// -- Ubicacion fija (si no tiene GPS) --
float LATITUDE = 11.019464;
float LONGITUDE = -74.851522;

// -- Intervalo de muestreo (ms) --
unsigned long SAMPLING_INTERVAL = 5000;

// =======================================================
//  PIR SIMULATION (SERIAL)
//  Escribe "1" + Enter para detectar movimiento
//  Escribe "0" + Enter para reposo
// =======================================================

bool pirDetected = false;
unsigned long pirLastChanged = 0;
int pirLastSentValue = -1;  // -1 = nunca enviado, 0/1 = valor anterior

// =======================================================
//  VARIABLES INTERNAS
// =======================================================

WebSocketsClient webSocket;
WiFiClientSecure wssClient; // SSL con setInsecure() para cert self-signed
String jwtToken = "";
bool socketConnected = false;
bool registered = false;
bool configReceived = false;
unsigned long lastSensorRead = 0;
unsigned long lastHeartbeatSent = 0;
unsigned long reconnectTimer = 0;
const unsigned long HEARTBEAT_INTERVAL_MS = 10000;

// =======================================================
//  FORWARD DECLARATIONS
// =======================================================

void registerDevice();
void handleConfigResponse(JsonVariant data);
void connectSocket();
void handleSerialPirInput();

// =======================================================
//  FUNCIONES AUXILIARES
// =======================================================

String generateDeviceId() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char id[20];
  snprintf(id, sizeof(id), "ESP32-%02X%02X%02X", mac[3], mac[4], mac[5]);
  return String(id);
}

void socketEmit(const char *event, JsonDocument &data) {
  if (!socketConnected)
    return;

  String payload = "42[\"";
  payload += event;
  payload += "\",";
  String jsonStr;
  serializeJson(data, jsonStr);
  payload += jsonStr;
  payload += "]";

  webSocket.sendTXT(payload);
  Serial.printf("[WS] Emit: %s\n", event);
}

void handleSerialPirInput() {
  while (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd == "1") {
      pirDetected = true;
      pirLastChanged = millis();
      Serial.println("[PIR] Movimiento detectado (1)");
    } else if (cmd == "0") {
      pirDetected = false;
      pirLastChanged = millis();
      Serial.println("[PIR] Sin movimiento (0)");
    } else if (cmd.length() > 0) {
      Serial.println("[PIR] Comando invalido. Use 1 o 0");
    }
  }
}

void handleSocketMessage(const char *payload, size_t length) {
  if (length == 0)
    return;

  if (payload[0] == '0') {
    Serial.println("[WS] Handshake -> enviando 40");
    webSocket.sendTXT("40");
    return;
  }

  if (payload[0] == '2') {
    webSocket.sendTXT("3");
    return;
  }

  if (payload[0] == '4' && payload[1] == '0') {
    socketConnected = true;
    registered = false;
    Serial.println("[WS] Conectado al namespace /");
    registerDevice();
    return;
  }

  if (payload[0] == '4' && payload[1] == '2') {
    const char *jsonStart = payload + 2;
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, jsonStart);
    if (err) {
      Serial.printf("[WS] Error parseando: %s\n", err.c_str());
      return;
    }
    const char *eventName = doc[0];
    if (strcmp(eventName, "device:config-response") == 0) {
      handleConfigResponse(doc[1]);
    }
  }
}

// =======================================================
//  AUTENTICACION HTTP
// =======================================================

bool authenticate() {
  if (WiFi.status() != WL_CONNECTED)
    return false;

  WiFiClientSecure client;
  client.setInsecure(); // Acepta certificado self-signed (LAN privada)

  HTTPClient http;
  String url = API_BASE + "/api/auth/device-register";

  Serial.printf("[AUTH] POST %s\n", url.c_str());
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  JsonDocument reqDoc;
  reqDoc["deviceId"] = DEVICE_ID;
  reqDoc["password"] = DEVICE_PASSWORD;
  String reqBody;
  serializeJson(reqDoc, reqBody);

  int httpCode = http.POST(reqBody);
  Serial.printf("[AUTH] HTTP %d\n", httpCode);

  if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
    String respBody = http.getString();
    JsonDocument respDoc;
    DeserializationError err = deserializeJson(respDoc, respBody);

    if (!err && respDoc["token"].is<const char *>()) {
      jwtToken = String(respDoc["token"].as<const char *>());
      Serial.println("[AUTH] JWT obtenido OK");
      http.end();
      return true;
    } else {
      Serial.println("[AUTH] Respuesta invalida (sin token)");
    }
  } else {
    Serial.printf("[AUTH] Error: %s\n", http.getString().c_str());
  }

  http.end();
  return false;
}

// =======================================================
//  REGISTRO Y CONFIGURACION
// =======================================================

void registerDevice() {
  Serial.printf("[REG] Registrando: %s\n", DEVICE_ID.c_str());

  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["name"] =
      DEVICE_NAME.length() > 0 ? DEVICE_NAME.c_str() : DEVICE_ID.c_str();
  doc["type"] = DEVICE_TYPE;
  doc["networkType"] = NETWORK_TYPE;
  doc["latitude"] = LATITUDE;
  doc["longitude"] = LONGITUDE;
  doc["hasGps"] = HAS_GPS;
  doc["samplingInterval"] = (int)(SAMPLING_INTERVAL / 1000);

  JsonObject sensorCfg = doc["sensorConfig"].to<JsonObject>();
  JsonObject pir = sensorCfg["pir"].to<JsonObject>();
  pir["type"] = "pir";
  pir["unit"] = "boolean";

  socketEmit("device:register", doc);
  registered = true;
}

void handleConfigResponse(JsonVariant data) {
  if (!data["success"].as<bool>()) {
    Serial.printf("[REG] Error: %s\n", data["error"].as<const char *>());
    String err = data["error"].as<const char *>();
    if (err.indexOf("utenticad") >= 0) {
      jwtToken = "";
      socketConnected = false;
    }
    return;
  }

  JsonObject config = data["config"];
  Serial.println("[REG] Config recibida:");
  Serial.printf("      Nombre:   %s\n", config["name"].as<const char *>());
  Serial.printf("      Tipo:     %s\n", config["type"].as<const char *>());
  Serial.printf("      Intervalo:%ds\n", config["samplingInterval"].as<int>());

  DEVICE_NAME = String(config["name"].as<const char *>());

  int interval = config["samplingInterval"].as<int>();
  if (interval > 0)
    SAMPLING_INTERVAL = (unsigned long)interval * 1000UL;

  if (!HAS_GPS && config["location"]["latitude"].as<float>() != 0.0f) {
    LATITUDE = config["location"]["latitude"].as<float>();
    LONGITUDE = config["location"]["longitude"].as<float>();
  }

  configReceived = true;
  Serial.println("[REG] Dispositivo listo -- enviando datos cada " +
                 String(SAMPLING_INTERVAL / 1000) + "s");
}

// =======================================================
//  LECTURA DE SENSORES
// =======================================================

void readAndSendSensors() {
  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  
  int currentPirValue = pirDetected ? 1 : 0;
  
  // Solo enviar si cambió respecto a la última vez
  if (pirLastSentValue == currentPirValue) {
    Serial.printf("[SENSOR] PIR sin cambio (seguía %d), no enviando\n", currentPirValue);
    return;
  }

  JsonObject sensorData = doc["sensorData"].to<JsonObject>();
  JsonObject pir = sensorData["pir"].to<JsonObject>();
  pir["value"] = currentPirValue;
  pir["detected"] = pirDetected;
  pir["type"] = "pir";
  pir["unit"] = "boolean";
  pir["lastChangedMs"] = (uint32_t)pirLastChanged;
  pir["timestamp"] = millis();

  Serial.printf("[SENSOR] PIR cambió a %d, enviando...\n", currentPirValue);
  pirLastSentValue = currentPirValue;
  
  socketEmit("device:sensor-update", doc);
}

void sendHeartbeat() {
  if (!socketConnected || !configReceived)
    return;

  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["latitude"] = LATITUDE;
  doc["longitude"] = LONGITUDE;
  socketEmit("device:heartbeat", doc);
}

// =======================================================
//  WiFi
// =======================================================

void connectWiFi() {
  Serial.printf("\n[WIFI] Conectando a: %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Conectado!");
    Serial.printf("       IP:  %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("       MAC: %s\n", WiFi.macAddress().c_str());
  } else {
    Serial.println("\n[WIFI] Fallo. Se reintentara...");
  }
}

// =======================================================
//  WebSocket / Socket.IO
// =======================================================

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
  switch (type) {
  case WStype_DISCONNECTED:
    Serial.println("[WS] Desconectado");
    socketConnected = false;
    registered = false;
    configReceived = false;
    break;
  case WStype_CONNECTED:
    Serial.printf("[WS] Conectado a: %s\n", (char *)payload);
    break;
  case WStype_TEXT:
    handleSocketMessage((char *)payload, length);
    break;
  case WStype_ERROR:
    Serial.println("[WS] Error de conexion");
    break;
  default:
    break;
  }
}

void connectSocket() {
  // El path completo va en la URL — EIO=4 + token JWT
  String socketPath = "/socket.io/?EIO=4&transport=websocket&token=";
  socketPath += jwtToken;

  Serial.printf("[WS] Conectando WSS raw a: %s:%d\n", SERVER_HOST, SERVER_PORT);

  // beginSslWithCA con NULL => internamente llama ssl->setInsecure()
  // (ver WebSocketsClient.cpp linea 294-295)
  // NO usar beginSocketIOSSL* porque ese hace polling HTTP primero (EIO=3 flow)
  webSocket.beginSslWithCA(SERVER_HOST, SERVER_PORT, socketPath.c_str(), NULL);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
  webSocket.enableHeartbeat(25000, 10000, 3);

  // JWT en header Authorization del handshake WebSocket
  String authHeader = "Authorization: Bearer " + jwtToken;
  webSocket.setExtraHeaders(authHeader.c_str());
}

// =======================================================
//  SETUP & LOOP
// =======================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=======================================================");
  Serial.println("  LTESISTEM -- ESP32 PIR Simulation Node");
  Serial.println("=======================================================");

  API_BASE = "https://";
  API_BASE += SERVER_HOST;
  API_BASE += ":";
  API_BASE += String(SERVER_PORT);

  DEVICE_ID = generateDeviceId();
  Serial.printf("[INIT] Device ID: %s\n", DEVICE_ID.c_str());
  Serial.println("[INIT] PIR serial simulation activa (1/0)");
  Serial.printf("[INIT] API Base:  %s\n", API_BASE.c_str());

  connectWiFi();

  if (WiFi.status() == WL_CONNECTED) {
    if (authenticate()) {
      connectSocket();
    } else {
      Serial.println("[INIT] Sin JWT -- reintentando en el loop");
    }
  }
}

void loop() {
  webSocket.loop();
  handleSerialPirInput();

  // ── Reconexion WiFi ──
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - reconnectTimer > 10000) {
      reconnectTimer = millis();
      Serial.println("[WIFI] Reconectando...");
      connectWiFi();
      if (WiFi.status() == WL_CONNECTED) {
        if (jwtToken.length() == 0)
          authenticate();
        if (jwtToken.length() > 0)
          connectSocket();
      }
    }
    return;
  }

  // ── Re-autenticar si no hay JWT ──
  if (jwtToken.length() == 0) {
    if (millis() - reconnectTimer > 15000) {
      reconnectTimer = millis();
      if (authenticate())
        connectSocket();
    }
    return;
  }

  // ── Enviar datos de sensores (tras recibir config) ──
  if (configReceived && millis() - lastSensorRead >= SAMPLING_INTERVAL) {
    lastSensorRead = millis();
    readAndSendSensors();
  }

  // ── Heartbeat independiente del muestreo ──
  if (configReceived && millis() - lastHeartbeatSent >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatSent = millis();
    sendHeartbeat();
  }
}
