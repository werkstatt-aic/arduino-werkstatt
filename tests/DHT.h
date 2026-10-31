#pragma once
#include <Arduino.h>
#define DHT11 11
#define DHT22 22
class DHT { public: DHT(uint8_t p, uint8_t t) {} void begin() {} float readTemperature(bool f = false) { return 0; } float readHumidity() { return 0; } };
