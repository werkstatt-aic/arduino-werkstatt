#pragma once
#include <Arduino.h>
class UpdateClass { public: bool begin(size_t size = 0xFFFFFFFF, int command = 0, int ledPin = -1, uint8_t ledOn = 0, const char *label = NULL);
  size_t write(uint8_t *data, size_t len); bool end(bool evenIfRemaining = false); bool isRunning(); void abort(); bool setMD5(const char *md5); };
extern UpdateClass Update;
