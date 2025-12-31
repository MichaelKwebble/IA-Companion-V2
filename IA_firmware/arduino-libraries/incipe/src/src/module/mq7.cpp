#if (ARDUINO >= 100)
#include "Arduino.h"
#else
#include <avr/io.h>
#include "WProgram.h"
#endif

#include "mq7.h"

mq7::mq7(SensorType type) : Sensor(type) { /*Serial.println("create MQ7");*/ };

mq7::mq7(SensorType type, uint8_t analog_pin, uint8_t digital_pin) : Sensor(type, analog_pin, digital_pin) { Serial.println("create MQ7"); };

mq7::~mq7() { Serial.println("delete MQ7"); };

void mq7::data_processor(void)
{
    mq7::ppm = getPPM();
};

float mq7::reading(int data_pin, int data)
{
    mq7::data_processor();
    return mq7::ppm;
};

float mq7::getPPM()
{
    return (float)(coefficient_A * pow(getRatio(), coefficient_B));
};

float mq7::voltageConversion(int value)
{
    return (float)value * (v_in / 4094.0);
};

float mq7::getRatio()
{
    int value = analogRead(analog_pin);
    float v_out = voltageConversion(value);
    return (v_in - v_out) / v_out;
};

float mq7::getSensorResistance()
{
    return R_Load * getRatio();
};