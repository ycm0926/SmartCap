#include "WebsocketModule.h"
#include <Arduino.h>
#include <WiFi.h>
#include "secrets.h"

WebsocketsClient wsClient;

void onMessageCallback(WebsocketsMessage message) {
  Serial.print("Received message: ");
  Serial.println(message.data());
}

void onEventsCallback(WebsocketsEvent event, String data) {
  if(event == WebsocketsEvent::ConnectionOpened) {
    Serial.println("WebSocket Connection Opened");
  } else if(event == WebsocketsEvent::ConnectionClosed) {
    Serial.println("WebSocket Connection Closed");
  } else if(event == WebsocketsEvent::GotPing) {
    Serial.println("WebSocket Got a Ping!");
  } else if(event == WebsocketsEvent::GotPong) {
    Serial.println("WebSocket Got a Pong!");
  }
}

void setupWebsocket() {
  wsClient.onMessage(onMessageCallback);
  wsClient.onEvent(onEventsCallback);
  String ws_url = String("ws://") + ws_server_host + ":" +
                  String(ws_server_port) + ws_server_path;
  wsClient.connect(ws_url);
  Serial.println("WebSocket connected");
}

void pollWebsocket() {
  wsClient.poll();
}
