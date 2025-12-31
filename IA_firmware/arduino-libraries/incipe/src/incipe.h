#pragma once
#ifndef INCIPE_H
#define INCIPE_H

#if (ARDUINO >= 100)
#include "Arduino.h"
#else
#include "WProgram.h"
#include <avr/io.h>
#endif

#include "FS.h"
#include "SD.h"
#include <SPI.h>
#include <string.h>
// #include <OneWire.h>
// #include <DallasTemperature.h>

#include "src/module/sensor.h"
#include "src/module/dht11.h"
#include "src/module/mq135.h"
#include "src/module/gl5528.h"
#include "src/module/mq3.h"
#include "src/module/mq7.h"
#include "src/module/hcsr04.h"
#include "src/module/mh1.h"
#include "src/module/czn15e.h"
#include "src/module/button.h"
#include "src/screen/EasyNextionLibrary.h"
#include "src/SensorSync.h"
#include "DataPacket.h"

#include <WiFi.h>
#include <WiFiUdp.h>
#include <WiFiClient.h>
#include <WiFiServer.h>

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

// #include <IRremoteESP8266.h>
// #include <IRrecv.h>
// #include <IRutils.h>
// #include <IRsend.h>

#define NUM_OF_SENSOR 4
#define NUM_OF_BIT 4
#define NUM_OF_DATA_MODE 2
#define ONE_WIRE_BUS 4

#define HSPI_MISO 13
#define HSPI_MOSI 11
#define HSPI_SCLK 12
#define HSPI_SS 10

#define CS_GPIO 5

extern WiFiServer server;
extern WiFiClient client;

// Add this at global scope
extern bool BLEInitialized;

class Incipe
{
private:
  EasyNex screen{Serial1}; // setup done
  // SPIClass *hspi = new SPIClass(HSPI);
  SensorSync sync;
  Sensor *sensor[NUM_OF_SENSOR] = {nullptr, nullptr, nullptr, nullptr};
  SensorType sensor_type[NUM_OF_SENSOR] = {NOT_DETECTED, NOT_DETECTED, NOT_DETECTED, NOT_DETECTED};
  String sensorWidget[9] = {"_temp", "_aq", "_button", "_flame", "_co", "_sound", "_light", "_alcohol", "_ultrasonic"};
  // ESP32 configuration
  uint8_t reading_pin[NUM_OF_SENSOR][NUM_OF_DATA_MODE] = {{5, 1}, {8, 4}, {6, 2}, {7, 3}}; // s3-MINI
  const uint8_t zpin[NUM_OF_SENSOR] = {
      9,
      16,
      14,
      15};
  // uint8_t reading_pin[NUM_OF_SENSOR][NUM_OF_DATA_MODE] = {{32, 22}, {33, 16}, {26, 14}, {25, 21}}; // v3x
  // const uint8_t zpin[NUM_OF_SENSOR] = {
  //     34,
  //     36,
  //     35,
  //     39}; // done 35 ,36, 34 ,39,
  // const uint8_t fpin = 17;
  uint16_t zpin_data[NUM_OF_SENSOR] = {0, 0, 0, 0};
  uint16_t prev_zpin_data[NUM_OF_SENSOR] = {0, 0, 0, 0};
  uint8_t check[NUM_OF_SENSOR] = {0, 0, 0, 0};
  SensorType prev_sensor_type[NUM_OF_SENSOR] = {NOT_DETECTED, NOT_DETECTED, NOT_DETECTED, NOT_DETECTED};
  String sensor_type_name[NUM_OF_SENSOR] = {"", "", "", ""};
  // Apps Management
  bool page_indicator = false;
  int prevPageVal = 0;
  bool activate;
  uint16_t i = 0;
  const char *ssid;
  const char *password;

  // useful helper function (sensor)
  void system_handler(void);
  void mircofan_controller(bool flag);
  bool equal(uint8_t previous_bits[4], uint8_t current_bits[4]);
  bool iszero(uint16_t data);
  bool connected(SensorType type);

  void sensorsync(uint16_t i);
  void sendSensorSyncJson(int port_number, SensorType token, int status, float value);
  String sensorJSON(uint8_t c[4], String n[4]);

public:
  Incipe(bool activate = true);
  ~Incipe();

  void init();
  /**
   * @brief void init()
   * this function is used for IA Kit initialization
   * activate incipe.init() in void setup()
   */

  void main();
  /**
   * @brief void main()
   * this function is used for managing IA Kit sensors / periperial modules
   * activate incipe.main() in void loop()
   */

  // DHT11
  float getTemperature() const;
  /**
   * @brief float Incipe::getTemperature() const
   * return real-time temperature in degree Celsius using DHT11
   */

  float getHumidity() const;
  /**
   * @brief float Incipe::getHumidity() const
   * return real-time humidity in percentage % (range: 0 - 100) using DHT11
   * 0 (less humid) <--------> 100 (more humid)
   */

  // MQ135
  float getPPM() const;
  // *** update:
  // float getPPM(SensorType type) const;
  /**
   * @brief float Incipe::getPPM() const;
   * return real-time estimated air quality
   * measuring CO, NOx, alcohol, Benzene, smoke and CO2 using MQ135
   */

  // DHT11 + MQ135
  float getCorrectedPPM(float temperature, float humidity) const;
  // *** update:
  // float getCorrectedPPM(SensorType type, float temperature, float humidity) const;
  /**
   * @brief float Incipe::getPPM() const;
   * return real-time accurated air quality, with reference to actual temperature and humidity
   * measuring CO, NOx, alcohol, Benzene, smoke and CO2 using MQ135
   */

  // GL5528
  float getLightIntensity() const;
  /**
   * @brief float Incipe::getLightIntensity(void) const
   * return real-time light intensity (range: 0 - 1023) using GL5528
   * 0 (darker) <--------> 1023 (brighter)
   */

  void controlBrightness(float light_intensity);
  /**
   * @brief void Incipe::controlBrightness(type::float);
   * helper function interfacing with IA Kit embedded screen brightness
   */

  // IA screen
  void onscreen(String txt_index, int data);
  void onscreen(String txt_index, float data);
  void onscreen(String txt_index, long data);
  void onscreen(String txt_index, String text);

  /**
   * @brief void Incipe::onscreen();
   * helper function interfacing with IA Kit embedded screen
   * accept @param int, float, String data type
   */

  int screenReadValue(String component);
  /**
   * @brief int Incipe::screenReadValue(type::String);
   * helper function interfacing with IA Kit embedded screen
   * receive command (in value) from the screen through serial communication
   */

  String screenReadString(String component);
  /**
   * @brief String Incipe::screenReadString(type::String);
   * helper function interfacing with IA Kit embedded screen
   * receive command (in string) from the screen through serial communication
   */

  void screenWriteValue(String component, uint32_t data);
  /**
   * @brief void Incipe::screenWriteValue(type::String, type::uint32_t);
   * helper function interfacing with IA Kit embedded screen
   * plot useful experimental graphs on IA screen, with specific data, e.g. humidity
   */

  void screenMode(String option, uint32_t command);
  /**
   * @brief void Incipe::selectMode(type::String, type::bool);
   *
   * option 1: "dims", [0,100]
   * option 2: "sleep", [0,1]
   * option 3: "volume", [0,100]
   * option 4: "vis-name", [0,1]
   */
  void screenTest(void);
  // 6 new functions for sensor
  float getAlcoholPPM(void) const;
  float getCOPPM(void) const;
  float getDistance(void) const;
  float getFlameIntensity(void) const;
  float getSoundIntensity(void) const;
  float getButtonResponse(void) const;

  // useful helper function (screen)
  void vis(String vis_component, bool activate);
  /**
   * @brief void Incipe::vis(type::String, type::bool);
   *  helper function interfacing with IA Kit embedded screen visual visibility
   */

  // microSD file management helper functions
  void testSDCard(void);
  void listDir(fs::FS &fs, const char *dirname, uint8_t levels);
  void createDir(fs::FS &fs, const char *path);
  void removeDir(fs::FS &fs, const char *path);
  void readFile(fs::FS &fs, const char *path);
  void writeFile(fs::FS &fs, const char *path, const char *message);
  void appendFile(fs::FS &fs, const char *path, const char *message);
  void renameFile(fs::FS &fs, const char *path1, const char *path2);
  void deleteFile(fs::FS &fs, const char *path);
  void testFileIO(fs::FS &fs, const char *path);

  void switchPage(int page);

  // WiFi API
  void connectToWiFi(const char *ssid, const char *password, bool isServer = false);
  void scanWiFiNetworks();
  String getWiFiStatus();
  void handleClient(DataPacket &packet);
  bool connectToServer(const char *serverIP);
  void sendDataToServer(const char *serverIP, DataPacket &packet);
  void waitForAck();

  // Bluetooth API
  void setupBLEServer(const char *deviceName);
  void scanBLEDevices(int scanTime = 5);

  void runSensorSync();
};

extern Incipe incipe;
#endif