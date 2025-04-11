#ifndef WEBSOCKET_MODULE_H
#define WEBSOCKET_MODULE_H

#include <ArduinoWebsockets.h>
using namespace websockets;

extern WebsocketsClient wsClient;

void setupWebsocket();
void pollWebsocket();

#endif // WEBSOCKET_MODULE_H
