#ifndef MQ135_H
#define MQ135_H
#if ARDUINO >= 100
#include "Arduino.h"
#else
#include "WProgram.h"
#endif

#include "sensor.h"
/// The load resistance on the board
#define RLOAD 10.0
/// Calibration resistance at atmospheric CO2 level
#define RZERO 76.63
/// Parameters for calculating ppm of CO2 from sensor resistance
#define PARA 116.6020682
#define PARB 2.769034857

/// Parameters to model temperature and humidity dependence
#define CORA 0.00035
#define CORB 0.02718
#define CORC 1.39538
#define CORD 0.0018

/// Atmospheric CO2 level for calibration purposes
#define ATMOCO2 397.13

class mq135 : public Sensor
{

private:
    float ppm = 0;
    float getCorrectionFactor(float t, float h);
    float getResistance(uint8_t pin);
    float getPPM(uint8_t pin);
    float getRZero(uint8_t pin);
    float getCorrectedRZero(float t, float h, uint8_t pin);
    float calculateCorrectedPPM(float t, float h, uint8_t pin);
    float getCorrectedResistance(float t, float h, uint8_t pin);
    void data_processor(uint8_t pin);

public:
    mq135(SensorType type);
    mq135(SensorType type, uint8_t analog_pin, uint8_t digital_pin);
    virtual ~mq135() override;
    virtual float reading(int data_pin = -1, int data = 0) override;
    virtual float corrected_reading(int data_pin = -1, float temperature = 0, float humidity = 0) override;
};
#endif