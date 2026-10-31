#pragma once
#include <Adafruit_GFX.h>
#include <Wire.h>
#define SSD1306_SWITCHCAPVCC 0x02
#define SSD1306_WHITE 1
#define SSD1306_BLACK 0
class Adafruit_SSD1306 : public Adafruit_GFX { public: Adafruit_SSD1306(uint8_t w, uint8_t h, TwoWire *twi = &Wire, int8_t rst_pin = -1);
  bool begin(uint8_t switchvcc = SSD1306_SWITCHCAPVCC, uint8_t i2caddr = 0, bool reset = true, bool periphBegin = true); void display(); void clearDisplay(); };
