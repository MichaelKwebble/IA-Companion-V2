#include "dht11.h"
#define TIMEOUT 10000

dht11::dht11(SensorType type) : Sensor(type) { /*Serial.println("create DHT11");*/ };

dht11::dht11(SensorType type, uint8_t analog_pin, uint8_t digital_pin) : Sensor(type, analog_pin, digital_pin)
{
    Serial.println("create DHT11");
    // pinMode(analog_pin, INPUT);
    pinMode(digital_pin, OUTPUT);
};

dht11::~dht11()
{
    Serial.println("delete DHT11");
}

float dht11::reading(int data_pin, int data)
{
    data_processor(digital_pin); // data_processor(data_pin);
    delay(50);
    if (data == 0)
        return dht11::humidity;
    else if (data == 1)
        return dht11::temperature;
    else
        return -1;
}; // handle two reading

int dht11::data_processor(uint8_t pin)
{
    int rv = data_receiver(pin);
    if (rv != 0)
        return rv;

    humidity = bits[0];    // bit[1] == 0;
    temperature = bits[2]; // bits[3] == 0;

    uint8_t sum = bits[0] + bits[2]; // bits[1] && bits[3] both 0
    if (bits[4] != sum)
        return -1;

    return 0;
}

int dht11::data_receiver(uint8_t pin)
{
    uint8_t cnt = 7;
    uint8_t idx = 0;

    for (int i = 0; i < 5; i++)
        bits[i] = 0;

    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW);
    delay(20);
    digitalWrite(pin, HIGH);
    delayMicroseconds(40);
    pinMode(pin, INPUT);

    unsigned int loopCnt = TIMEOUT;
    while (digitalRead(pin) == LOW)
        if (loopCnt-- == 0)
            return -2;

    loopCnt = TIMEOUT;
    while (digitalRead(pin) == HIGH)
        if (loopCnt-- == 0)
            return -2;

    for (int i = 0; i < 40; i++)
    {
        loopCnt = TIMEOUT;
        while (digitalRead(pin) == LOW)
            if (loopCnt-- == 0)
                return -2;

        unsigned long t = micros();

        loopCnt = TIMEOUT;
        while (digitalRead(pin) == HIGH)
            if (loopCnt-- == 0)
                return -2;

        if ((micros() - t) > 40)
            bits[idx] |= (1 << cnt);
        if (cnt == 0) // next byte?
        {
            cnt = 7;
            idx++;
        }
        else
            cnt--;
    }
    return 0;
}