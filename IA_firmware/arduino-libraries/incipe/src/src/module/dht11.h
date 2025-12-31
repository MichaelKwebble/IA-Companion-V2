#ifndef DHT11_H
#define DHT11_H
#if ARDUINO >= 100
#include "Arduino.h"
#else
#include "WProgram.h"
#endif

#include "sensor.h"

class dht11 : public Sensor
{
private:
    float humidity = -1;
    float temperature = -1;
    int8_t bits[5];
    int data_processor(uint8_t pin);
    int data_receiver(uint8_t pin); // equivalent to read()

public:
    dht11(SensorType type);
    dht11(SensorType type, uint8_t analog_pin, uint8_t digital_pin);
    virtual ~dht11() override;
    virtual float reading(int data_pin = -1, int data = 0);
};

#endif