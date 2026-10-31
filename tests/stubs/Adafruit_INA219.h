#pragma once
#include <Arduino.h>
#include <Wire.h>
class Adafruit_INA219 { public: Adafruit_INA219(uint8_t addr = 0x40); bool begin(TwoWire *theWire = &Wire);
  void setCalibration_32V_2A(); void setCalibration_32V_1A(); void setCalibration_16V_400mA();
  float getBusVoltage_V(); float getShuntVoltage_mV(); float getCurrent_mA(); };
