#ifndef MQ3_H
#define MQ3_H

#if ARDUINO >= 100
#include "Arduino.h"
#else
#include "WProgram.h"
#endif

#include "sensor.h"

#define AIR 60.0 // The RS/R0 ratio is a constant 60 in "clean air"

/* Define types Unit of MQ-3 */
#define PERCENT_BAC 1 // Blood alcohol level (%) of BAC
#define G_PER_ML 2    // Gram Per Millilitre (g/mL) of BAC
#define PPM 3         // Parts Per Million (ppm) of BrAC
                      // Milligrams Per Liter (mg/L) of BrAC

class mq3 : public Sensor
{
public:
    mq3(SensorType type);
    mq3(SensorType type, uint8_t analog_pin, uint8_t digital_pin);
    virtual ~mq3() override;
    virtual float reading(int data_pin = -1, int data = 0) override;
    void begin();
    float readAlcoholConcentration(uint8_t unit = PPM);
    float readRawValueOfAlcohol(); // Unit (mg/L), based on ratio RS/RO

    float convertRawToBAC(float raw);
    float convertRawToGramPerMillilitre(float raw);
    float convertRawToPPM(float raw);

private:
    uint8_t _pin;
    float _res2 = 2000, _resO;
    bool _isPower5v = true;
    bool do_once_flag = true;
    float calculateRS();
};

#endif