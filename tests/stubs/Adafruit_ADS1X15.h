#pragma once
#include <Arduino.h>
#include <Wire.h>
typedef enum { GAIN_TWOTHIRDS, GAIN_ONE, GAIN_TWO, GAIN_FOUR, GAIN_EIGHT, GAIN_SIXTEEN } adsGain_t;
class Adafruit_ADS1X15 { public: bool begin(uint8_t i2c_addr = 0x48, TwoWire *wire = &Wire); void setGain(adsGain_t gain);
  int16_t readADC_SingleEnded(uint8_t channel); int16_t readADC_Differential_0_1(); int16_t readADC_Differential_2_3(); float computeVolts(int16_t counts); };
class Adafruit_ADS1115 : public Adafruit_ADS1X15 { public: Adafruit_ADS1115(); };
