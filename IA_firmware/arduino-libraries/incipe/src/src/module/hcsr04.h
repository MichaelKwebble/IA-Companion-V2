#ifndef HCSR04_H
#define HCSR04_H
#if ARDUINO >= 100
#include "Arduino.h"
#else
#include "WProgram.h"
#endif

#include "sensor.h"

class Ultrasonic : public Sensor
{
public:
    Ultrasonic(SensorType type);
    Ultrasonic(SensorType type, uint8_t analog_pin, uint8_t digital_pin);
    virtual ~Ultrasonic() override;
    virtual float reading(int data_pin = -1, int data = 0); // data_pin (analog), data (digital)
};

#endif