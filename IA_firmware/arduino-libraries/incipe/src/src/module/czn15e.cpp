#include "czn15e.h"

Microphone::Microphone(SensorType type) : Sensor(type) { /*Serial.println("create CZ-N15e");*/ };

Microphone::Microphone(SensorType type, uint8_t analog_pin, uint8_t digital_pin) : Sensor(type, analog_pin, digital_pin) { Serial.println("create CZ-N15e"); };

Microphone::~Microphone()
{
    Serial.println("delete CZ-N15e");
};

float Microphone::reading(int data_pin, int data)
{
    return digitalRead(digital_pin);
};