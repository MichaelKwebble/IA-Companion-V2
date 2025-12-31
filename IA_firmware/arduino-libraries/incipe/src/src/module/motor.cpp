#include "motor.h"
Motor::Motor(SensorType type) : Sensor(type) { /*Serial.println("create motor");*/ };

Motor::Motor(SensorType type, uint8_t analog_pin, uint8_t digital_pin) : Sensor(type, analog_pin, digital_pin)
{
    // Serial.println("create motor");
    pinMode(analog_pin, OUTPUT);
    pinMode(digital_pin, OUTPUT);
};

Motor::~Motor() {
    /*Serial.println("delete motor");*/
};

float Motor::reading(int data_pin, int data) { return 0; };

void Motor::setSpeed(float speed)
{
    float voltage = map(speed, -100, 100, 0, 5);
    if (speed > 0 && speed <= 100)
    {
        analogWrite(analog_pin, voltage);
        analogWrite(digital_pin, 0);
    }

    else if (speed < 0 && speed >= -100)
    {
        analogWrite(analog_pin, 0);
        analogWrite(digital_pin, voltage);
    }

    else
    {
        analogWrite(analog_pin, 0);
        analogWrite(digital_pin, 0);
    }
};