#ifndef CZN15E_H
#define CZN15E_H

#if ARDUINO >= 100
#include "Arduino.h"
#else
#include "WProgram.h"
#endif

#include "sensor.h"

class Microphone : public Sensor
{
public:
    Microphone(SensorType type);
    Microphone(SensorType type, uint8_t analog_pin, uint8_t digital_pin);
    virtual ~Microphone() override;
    virtual float reading(int data_pin = -1, int data = 0) override;
};

#endif