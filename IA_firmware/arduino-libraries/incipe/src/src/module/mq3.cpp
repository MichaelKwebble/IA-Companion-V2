#include "mq3.h"
mq3::mq3(SensorType type) : Sensor(type) { /*Serial.println("create MQ3");*/ };

mq3::mq3(SensorType type, uint8_t analog_pin, uint8_t digital_pin) : Sensor(type, analog_pin, digital_pin)
{
    Serial.println("create MQ3");
};

mq3::~mq3() {
    // Serial.println("delete MQ3");
};

float mq3::reading(int data_pin, int data)
{
    if (do_once_flag)
    {
        begin();
        do_once_flag = false;
    }

    return readAlcoholConcentration();
};

/////////////////////////////////////////////////////////////////////

/*!
 *  @brief  It will delay ~20s to heat probe sensor to ready
 *          Then calculate value RO based on RS
 */
void mq3::begin()
{
    // delay(20000);
    _resO = 0;

    uint8_t count = 10;
    uint8_t i = count;
    while (i--)
    {
        _resO += (mq3::calculateRS() / AIR); // Calculate the average of RO (RO = RS/60)
        // delay(100);
    }
    _resO /= (float)count;
}

/*!
 *  @brief  Read Alcohol Concentration
 *  @param  unit
 *          The unit (%) of (BAC)
 *          The unit (g/mL) of (BAC)
 *          The unit default (ppm) of (BrAC)
 */
float mq3::readAlcoholConcentration(uint8_t unit)
{
    switch (unit)
    {
    case PERCENT_BAC:
        return mq3::convertRawToBAC(mq3::readRawValueOfAlcohol());
    case G_PER_ML:
        return mq3::convertRawToGramPerMillilitre(mq3::readRawValueOfAlcohol());
    case PPM:
        return mq3::convertRawToPPM(mq3::readRawValueOfAlcohol());
    }
}

/*!
 *  @brief  Calculate the concentration of alcohol is present in Air, unit (mg/L) of (BrAC)
 */
float mq3::readRawValueOfAlcohol()
{
    return 0.4 * pow(mq3::calculateRS() / _resO, -1.43068);
}

/////////////////////////////////////////////////////////////////////

/*!
 *  @brief  Convert the value unit (mg/L) of (BrAC) to unit (%) of (BAC)
 *          1 mg/L <=> 0,2% BAC
 */
float mq3::convertRawToBAC(float raw)
{
    return raw * 0.2;
}

/*!
 *  @brief  Convert the value unit (mg/L) of (BrAC) to unit (g/mL) of (BAC)
 *          1 mg/L <=> 0,002 g/mL
 */
float mq3::convertRawToGramPerMillilitre(float raw)
{
    return raw * 0.002;
}

/*!
 *  @brief  Convert the value unit (mg/L) of (BrAC) to unit (ppm) of (BrAC)
 *          1 mg/L <=> 500 ppm
 */
float mq3::convertRawToPPM(float raw)
{
    return raw * 500.0;
}

/////////////////////////////////////////////////////////////////////

/*!
 *  @brief  Calculate value RS based on R2 and level Logic with the value Analog voltage of sensor
 */
float mq3::calculateRS()
{
    float sensorValue = analogRead(analog_pin);
    float sensorVolt = sensorValue * (_isPower5v ? 5.0 : 3.3) / (_isPower5v ? 1024.0 : 675.84);
    float RS = (_isPower5v ? 5.0 : 3.3) * _res2 / sensorVolt - _res2;

    return RS;
}