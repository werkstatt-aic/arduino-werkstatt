#pragma once
#include <Arduino.h>
class Servo { public: uint8_t attach(int pin); uint8_t attach(int pin, int min, int max); void write(int value); };
