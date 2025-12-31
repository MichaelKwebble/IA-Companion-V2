#include "button.h"
Button::Button(SensorType type) : Sensor(type) { Serial.println("create button"); };

Button::Button(SensorType type, uint8_t analog_pin, uint8_t digital_pin) : Sensor(type, analog_pin, digital_pin)
{
    Serial.println("create button");
    Serial.println(digital_pin);
};

Button::~Button()
{
    Serial.println("delete button");
};

float Button::reading(int data_pin, int data) { return digitalRead(digital_pin); };