#pragma once
#include <Arduino.h>
typedef struct {} esp_ble_gatts_cb_param_t;
class BLECharacteristic;
class BLECharacteristicCallbacks { public: virtual ~BLECharacteristicCallbacks();
  virtual void onRead(BLECharacteristic *c); virtual void onWrite(BLECharacteristic *c); virtual void onWrite(BLECharacteristic *c, esp_ble_gatts_cb_param_t *p); };
class BLECharacteristic { public:
  static const uint32_t PROPERTY_READ = 1 << 0, PROPERTY_WRITE = 1 << 1, PROPERTY_NOTIFY = 1 << 2, PROPERTY_WRITE_NR = 1 << 5;
  void setCallbacks(BLECharacteristicCallbacks *cb); void setValue(String value); void setValue(uint8_t *data, size_t size);
  uint8_t *getData(); size_t getLength(); String getValue(); };
class BLEService { public: BLECharacteristic *createCharacteristic(const char *uuid, uint32_t properties); void start(); };
class BLEServer;
class BLEServerCallbacks { public: virtual ~BLEServerCallbacks(); virtual void onConnect(BLEServer *s); virtual void onDisconnect(BLEServer *s); };
class BLEServer { public: BLEService *createService(const char *uuid); void setCallbacks(BLEServerCallbacks *cb); };
class BLEAdvertising { public: void addServiceUUID(const char *uuid); void setScanResponse(bool); };
class BLEDevice { public: static void init(String deviceName); static bool setMTU(uint16_t mtu); static BLEServer *createServer();
  static BLEAdvertising *getAdvertising(); static void startAdvertising(); };
