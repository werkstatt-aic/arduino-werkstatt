#pragma once
#include <Arduino.h>
#define makeKeymap(x) ((char*)x)
#define NO_KEY '\0'
class Keypad { public: Keypad(char *userKeymap, byte *row, byte *col, byte numRows, byte numCols); char getKey(); };
