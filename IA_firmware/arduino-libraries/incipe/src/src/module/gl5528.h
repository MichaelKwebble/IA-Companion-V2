#ifndef GL5528_H
#define GL5528_H
#if ARDUINO >= 100
#include "Arduino.h"
#else
#include "WProgram.h"
#endif

#include "sensor.h"
#define LIGHT_INTENSITY_MAX_RANGE 4095
class gl5528 : public Sensor
{
public:
    gl5528(SensorType type);
    gl5528(SensorType type, uint8_t analog_pin, uint8_t digital_pin);
    virtual ~gl5528() override;
    virtual float reading(int data_pin = -1, int data = 0) override;
};

#endif