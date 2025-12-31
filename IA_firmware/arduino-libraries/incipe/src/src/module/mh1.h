#ifndef MH1_H
#define MH1_H

#if ARDUINO >= 100
#include "Arduino.h"
#else
#include "WProgram.h"
#endif

#include "sensor.h"

class Mh1 : public Sensor
{
public:
    Mh1(SensorType type);
    Mh1(SensorType type, uint8_t analog_pin, uint8_t digital_pin);
    virtual ~Mh1() override;
    virtual float reading(int data_pin = -1, int data = 0) override;
};

#endif