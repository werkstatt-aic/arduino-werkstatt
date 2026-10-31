#pragma once
#include <Arduino.h>
class Adafruit_GFX : public Print { public: Adafruit_GFX(int16_t w, int16_t h);
  void drawPixel(int16_t x, int16_t y, uint16_t color); void drawLine(int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint16_t color);
  void drawRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color); void fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color);
  void drawCircle(int16_t x0, int16_t y0, int16_t r, uint16_t color); void fillCircle(int16_t x0, int16_t y0, int16_t r, uint16_t color);
  void drawBitmap(int16_t x, int16_t y, const uint8_t bitmap[], int16_t w, int16_t h, uint16_t color);
  void setCursor(int16_t x, int16_t y); void setTextSize(uint8_t s); void setTextColor(uint16_t c); void cp437(bool x = true); };
