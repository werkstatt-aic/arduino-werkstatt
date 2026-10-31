#pragma once
#include <Arduino.h>
class Servo { public: int attach(int pin); int attach(int pin, int min, int max); void write(int value); };
