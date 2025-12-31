#ifndef MOTOR_H
#define MOTOR_H
#if ARDUINO >= 100
#include "Arduino.h"
#else
#include "WProgram.h"
#endif

#include "sensor.h"

class Motor : public Sensor
{
public:
    Motor(SensorType type);
    Motor(SensorType type, uint8_t analog_pin, uint8_t digital_pin);
    virtual ~Motor() override;
    virtual float reading(int data_pin = -1, int data = 0) override;

    // specialized function
    void setSpeed(float speed); // range: [-100, 100]
};

#endif