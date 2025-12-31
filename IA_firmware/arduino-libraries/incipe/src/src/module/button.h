#ifndef BUTTON_H
#define BUTTON_H

#if ARDUINO >= 100
#include "Arduino.h"
#else
#include "WProgram.h"
#endif

#include "sensor.h"

class Button : public Sensor
{
public:
    Button(SensorType type);
    Button(SensorType type, uint8_t analog_pin, uint8_t digital_pin);
    virtual ~Button() override;
    virtual float reading(int data_pin, int data) override;
};

#endif