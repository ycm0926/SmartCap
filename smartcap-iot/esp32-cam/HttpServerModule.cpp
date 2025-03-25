#include "HttpServerModule.h"
#include <WiFi.h>
#include <Arduino.h>
#include "esp_camera.h"

WebServer httpServer(80);

void handleRoot() {
  String html = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>ESP32-CAM Live Stream</title></head><body>";
  html += "<h1>ESP32-CAM Live Stream</h1>";
  html += "<img src='/stream' style='width:100%;max-width:800px;' />";
  html += "</body></html>";
  httpServer.send(200, "text/html", html);
}

void handleJPGStream() {
  WiFiClient streamClient = httpServer.client();
  String response = "HTTP/1.1 200 OK\r\n";
  response += "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n\r\n";
  httpServer.sendContent(response);

  while(streamClient.connected()) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      break;
    }
    response = "--frame\r\n";
    response += "Content-Type: image/jpeg\r\n\r\n";
    httpServer.sendContent(response);
    streamClient.write(fb->buf, fb->len);
    httpServer.sendContent("\r\n");
    esp_camera_fb_return(fb);
    delay(100); // 약 10fps
  }
}

void setupHttpServer() {
  httpServer.on("/", HTTP_GET, handleRoot);
  httpServer.on("/stream", HTTP_GET, handleJPGStream);
  httpServer.begin();
  Serial.println("HTTP server started");
}
