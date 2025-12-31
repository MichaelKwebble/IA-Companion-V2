#include "hcsr04.h"

Ultrasonic::Ultrasonic(SensorType type) : Sensor(type) { /* Serial.println("create HCSR04");*/ };

Ultrasonic::Ultrasonic(SensorType type, uint8_t analog_pin, uint8_t digital_pin) : Sensor(type, analog_pin, digital_pin)
{
    // Serial.println("create Ultrasonic");
    pinMode(analog_pin, INPUT);   // echoPin
    pinMode(digital_pin, OUTPUT); // trigPin
};

Ultrasonic::~Ultrasonic()
{
    // Serial.println("delete HCSR04");
    pinMode(analog_pin, INPUT);  // echoPin
    pinMode(digital_pin, INPUT); // trigPin};
}
float Ultrasonic::reading(int data_pin, int data)
{
    // pinMode(analog_pin, INPUT);   // echoPin
    // pinMode(digital_pin, OUTPUT); // trigPin
    // digitalWrite(digital_pin, LOW);
    // delayMicroseconds(2);

    // digitalWrite(digital_pin, HIGH);
    // delayMicroseconds(10);
    // digitalWrite(digital_pin, LOW);

    // long duration = pulseIn(analog_pin, HIGH);

    // Calculating the distance
    // return (duration * 0.034 / 2) > 2 && (duration * 0.034 / 2) < 1000 ? (duration * 0.034 / 2) : -1.0;
    // return (duration * 0.034 / 2);
    digitalWrite(digital_pin, LOW);
    delayMicroseconds(2);
    // Sets the trigPin on HIGH state for 10 micro seconds
    digitalWrite(digital_pin, HIGH);
    delayMicroseconds(10);
    digitalWrite(digital_pin, LOW);

    // Reads the echoPin, returns the sound wave travel time in microseconds
    long duration = pulseIn(analog_pin, HIGH, 30000); // 30ms timeout

    // Calculate the distance
    float distanceCm = duration * 0.034 / 2;

    // Convert to inches
    float distanceInch = distanceCm * 0.393701;
    return distanceCm;
};