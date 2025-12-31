#include "sensor.h"

Sensor::Sensor(SensorType type) : type(type){};

Sensor::Sensor(SensorType type, uint8_t analog_pin, uint8_t digital_pin) : type(type), analog_pin(analog_pin), digital_pin(digital_pin){};

Sensor::~Sensor(){
    // Serial.println("delete sensor");
};

float Sensor::corrected_reading(int data_pin, float temperature, float humidity) { return -1; };