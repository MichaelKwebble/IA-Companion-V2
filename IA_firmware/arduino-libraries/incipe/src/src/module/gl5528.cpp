#include "gl5528.h"

gl5528::gl5528(SensorType type) : Sensor(type) {
                                      /* Serial.println("create GL5528");*/
                                  };

gl5528::gl5528(SensorType type, uint8_t analog_pin, uint8_t digital_pin) : Sensor(type, analog_pin, digital_pin) {
                                                                               // Serial.println("create GL5528");
                                                                               // Serial.println(analog_pin);
                                                                               // Serial.println(digital_pin);
                                                                               // pinMode(analog_pin, INPUT);
                                                                               // pinMode(digital_pin, INPUT);
                                                                           };

gl5528::~gl5528()
{
    // Serial.println("delete GL5528");
}
/**************************************************************************/
/*!
@brief  Get the light intensity sensed

@return The light intensity received from nearby atmosphere
*/
/**************************************************************************/

float gl5528::reading(int data_pin, int data)
{
    if (data_pin != -1)
        return (float)(analogRead(analog_pin)); // previously analogRead(data_pin)
    else
        return -1;
}