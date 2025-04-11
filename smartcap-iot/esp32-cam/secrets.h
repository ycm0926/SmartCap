// secrets.h
#ifndef SECRETS_H
#define SECRETS_H

#include <Arduino.h> // uint16_t 등 필요한 타입 포함

extern const char* ssid;
extern const char* password;
extern const char* ws_server_host;
extern const uint16_t ws_server_port;
extern const char* ws_server_path;

#endif // SECRETS_H
