#ifndef HTTPSERVER_MODULE_H
#define HTTPSERVER_MODULE_H

#include <WebServer.h>

extern WebServer httpServer;

void setupHttpServer();
void handleRoot();
void handleJPGStream();

#endif // HTTPSERVER_MODULE_H
