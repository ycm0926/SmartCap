#include <Arduino.h>
#include <WiFi.h>
#include "esp_camera.h"
#include <ArduinoWebsockets.h>
#include <WebServer.h>

// 모듈 헤더 포함
#include "CameraModule.h"
#include "WebsocketModule.h"
#include "HttpServerModule.h"
#include "secrets.h"

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  // WiFi 연결
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  Serial.println();
  Serial.print("WiFi connected, IP address: ");
  Serial.println(WiFi.localIP());
  
  // 카메라 초기화
  setupCamera();
  
  // 웹소켓 설정
  setupWebsocket();
  
  // HTTP 서버 설정
  setupHttpServer();
}

void loop() {
  pollWebsocket();
  httpServer.handleClient();
  
  unsigned long frameStart = millis();
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed");
    delay(10);
    return;
  }
  
  bool sendResult = wsClient.sendBinary((const char*)fb->buf, fb->len);
  if (!sendResult) {
    Serial.println("Failed to send binary frame");
  } else {
    Serial.print("Sent binary frame: ");
    Serial.print(fb->len);
    Serial.println(" bytes");
  }
  esp_camera_fb_return(fb);
  
  // 약 10fps 목표 (프레임 당 약 100ms)
  unsigned long elapsed = millis() - frameStart;
  if (elapsed < 100) {
    delay(100 - elapsed);
  } else {
    delay(1);
  }
}
