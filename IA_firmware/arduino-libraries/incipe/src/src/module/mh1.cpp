#include "mh1.h"

Mh1::Mh1(SensorType type) : Sensor(type) { /*Serial.println("create mh1");*/ };

Mh1::Mh1(SensorType type, uint8_t analog_pin, uint8_t digital_pin) : Sensor(type, analog_pin, digital_pin)
{
    Serial.println("create mh1");
    Serial.println(analog_pin);
    Serial.println(digital_pin);
};

Mh1::~Mh1()
{
    Serial.println("delete mh1");
};

float Mh1::reading(int data_pin, int data) { return analogRead(analog_pin); };