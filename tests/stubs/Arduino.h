#pragma once
#include <stdint.h>
#include <math.h>
#include <stdlib.h>
typedef uint8_t byte; typedef bool boolean;
#define HIGH 1
#define LOW 0
#define INPUT 0
#define OUTPUT 1
#define LED_BUILTIN 13
#define PROGMEM
enum { A0 = 14, A1, A2, A3, A4, A5 };
void pinMode(uint8_t, uint8_t); void digitalWrite(uint8_t, uint8_t); int digitalRead(uint8_t);
int analogRead(uint8_t);
#ifdef ESP32
uint32_t analogReadMilliVolts(uint8_t);
#endif
void analogWrite(uint8_t, int); void delay(unsigned long); void delayMicroseconds(unsigned int);
unsigned long pulseIn(uint8_t, uint8_t, unsigned long timeout = 1000000L);
void tone(uint8_t, unsigned int, unsigned long duration = 0); void noTone(uint8_t);
long map(long, long, long, long, long); long random(long); long random(long, long);
#define constrain(amt,low,high) ((amt)<(low)?(low):((amt)>(high)?(high):(amt)))
class String {
 public:
  String(const char* s = ""); String(char c); String(int v); String(unsigned int v); String(long v); String(unsigned long v); String(float v, int d = 2); String(double v, int d = 2);
  String(const String&);
  String& operator=(const String&);
  friend String operator+(const String&, const String&);
  bool operator==(const String&) const; bool operator!=(const String&) const;
  bool startsWith(const String&) const; String substring(unsigned int) const; String substring(unsigned int, unsigned int) const; int indexOf(char, unsigned int = 0) const; unsigned int length() const; const char *c_str() const; long toInt() const;
};
class Print { public:
  size_t print(const String&); size_t print(const char*); size_t print(char); size_t print(int); size_t print(long); size_t print(unsigned long); size_t print(double, int = 2);
  size_t println(const String&); size_t println(const char*); size_t println(char); size_t println(int); size_t println(long); size_t println(unsigned long); size_t println(double, int = 2); };
class HardwareSerial : public Print { public: void begin(unsigned long); };
extern HardwareSerial Serial;

#ifdef ESP32
#include <string.h>
class EspClass { public: void restart(); }; extern EspClass ESP;
typedef void (*TaskFunction_t)(void *); typedef uint32_t TickType_t; typedef void* TaskHandle_t; typedef unsigned int UBaseType_t;
#define portTICK_PERIOD_MS ((TickType_t)1)
int xTaskCreate(TaskFunction_t, const char*, uint32_t, void*, UBaseType_t, TaskHandle_t*); void vTaskDelay(TickType_t);
#endif
