#ifndef MQ7_H
#define MQ7_H
#if ARDUINO >= 100
#include "Arduino.h"
#else
#include "WProgram.h"
#endif

#include "sensor.h"

#define coefficient_A 19.32
#define coefficient_B -0.64
#define R_Load 10.0

class mq7 : public Sensor
{
private:
    float v_in{5.0};
    float voltageConversion(int);
    float ppm;
    void data_processor();

public:
    mq7(SensorType type);
    mq7(SensorType type, uint8_t analog_pin, uint8_t digital_pin);
    virtual ~mq7() override;
    virtual float reading(int data_pin = -1, int data = 0) override;
    float getPPM();
    float getSensorResistance();
    float getRatio();
};

#endif