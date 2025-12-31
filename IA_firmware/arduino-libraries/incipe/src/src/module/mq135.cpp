#include "mq135.h"

mq135::mq135(SensorType type) : Sensor(type) {
                                    // Serial.println("create MQ135");
                                };

mq135::mq135(SensorType type, uint8_t analog_pin, uint8_t digital_pin) : Sensor(type, analog_pin, digital_pin) {
                                                                             // Serial.println("create MQ135");
                                                                             // pinMode(analog_pin, INPUT);
                                                                             // pinMode(digital_pin, INPUT);
                                                                         };

mq135::~mq135()
{
    // Serial.println("delete MQ135");
}
float mq135::reading(int data_pin, int data)
{
    data_processor(analog_pin); // data_processor(data_pin);
    return mq135::ppm;
};

float mq135::corrected_reading(int data_pin, float temperature, float humidity)
{
    return mq135::calculateCorrectedPPM(temperature, humidity, data_pin);
}
/**************************************************************************/
/*!
@brief  Get the correction factor to correct for temperature and humidity

@param[in] t  The ambient air temperature
@param[in] h  The relative humidity

@return The calculated correction factor
*/
/**************************************************************************/
float mq135::getCorrectionFactor(float t, float h)
{
    return CORA * t * t - CORB * t + CORC - (h - 33.) * CORD;
}

/**************************************************************************/
/*!
@brief  Get the resistance of the sensor, ie. the measurement value

@return The sensor resistance in kOhm
*/
/**************************************************************************/
float mq135::getResistance(uint8_t pin)
{
    int val = analogRead(pin);
    return ((4094. / (float)val) * 5. - 1.) * RLOAD;
}

/**************************************************************************/
/*!
@brief  Get the resistance of the sensor, ie. the measurement value corrected
        for temp/hum

@param[in] t  The ambient air temperature
@param[in] h  The relative humidity

@return The corrected sensor resistance kOhm
*/
/**************************************************************************/
float mq135::getCorrectedResistance(float t, float h, uint8_t pin)
{
    return getResistance(pin) / getCorrectionFactor(t, h);
}

/**************************************************************************/
/*!
@brief  Get the ppm of CO2 sensed (assuming only CO2 in the air)

@return The ppm of CO2 in the air
*/
/**************************************************************************/
float mq135::getPPM(uint8_t pin)
{
    return PARA * pow((getResistance(pin) / RZERO), -PARB);
}

/**************************************************************************/
/*!
@brief  Get the ppm of CO2 sensed (assuming only CO2 in the air), corrected
        for temp/hum

@param[in] t  The ambient air temperature
@param[in] h  The relative humidity

@return The ppm of CO2 in the air
*/
/**************************************************************************/
float mq135::calculateCorrectedPPM(float t, float h, uint8_t pin)
{
    return PARA * pow((getCorrectedResistance(t, h, pin) / RZERO), -PARB);
}

/**************************************************************************/
/*!
@brief  Get the resistance RZero of the sensor for calibration purposes

@return The sensor resistance RZero in kOhm
*/
/**************************************************************************/
float mq135::getRZero(uint8_t pin)
{
    return getResistance(pin) * pow((ATMOCO2 / PARA), (1. / PARB));
}

/**************************************************************************/
/*!
@brief  Get the corrected resistance RZero of the sensor for calibration
        purposes

@param[in] t  The ambient air temperature
@param[in] h  The relative humidity

@return The corrected sensor resistance RZero in kOhm
*/
/**************************************************************************/
float mq135::getCorrectedRZero(float t, float h, uint8_t pin)
{
    return getCorrectedResistance(t, h, pin) * pow((ATMOCO2 / PARA), (1. / PARB));
}

void mq135::data_processor(uint8_t pin)
{
    mq135::ppm = getPPM(pin);
}