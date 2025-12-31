#ifndef SENSOR_H
#define SENSOR_H
#if ARDUINO >= 100
#include "Arduino.h"
#else
#include "WProgram.h"
#endif
typedef enum SensorType
{
    DHT11,    // 1. Temperature and humidity module (tested, auto-detection)
    GL5528,   // 2. Light module (tested, auto-detection)
    MQ135,    // 3. MQ-series: air quality module (tested, auto-detection)
    MQ3,      // 4. MQ-series: methane, butane, LPG, humus PPM detection (not tested)
    MQ7,      // 5. MQ-series: carbon monoxide PPM detection (tested, library ready)
    HCSR04,   // 6. Ultrasonic module (tested, library ready)
    CZN15E,   // 7. Microphone module (tested, library ready)
    MH1,      // 8. Flame detection (tested, library ready)
    BUTTON,   // 9. Button module (tested)
    HOMESYNC, // 10. HomeSync module (tested)
    MOTOR,    // 11. Motor module (Robotics Extension, not tested)
    CAMERA,   // 12. Embedded Camera module (Robotics Extension, not tested)
    NOT_DETECTED = -1
} SensorType;

class Sensor
{
protected:
    SensorType type = NOT_DETECTED;
    uint8_t analog_pin = -1;
    uint8_t digital_pin = -1;

public:
    Sensor(SensorType type);
    Sensor(SensorType type, uint8_t analog_pin, uint8_t digital_pin);
    virtual ~Sensor();
    virtual float reading(int data_pin = -1, int data = 0) = 0;
    virtual float corrected_reading(int data_pin = -1, float temperature = 0, float humidity = 0);
};

#endif