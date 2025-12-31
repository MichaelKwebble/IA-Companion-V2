#include "SensorSync.h"

SensorSync::SensorSync(void) {};

SensorSync::~SensorSync(void) {};

SensorType SensorSync::getSensorType(int freq)
{
    if (freq >= freq_limit[DHT11][0] && freq <= freq_limit[DHT11][1])
    {
        return DHT11;
    }
    else if (freq >= freq_limit[GL5528][0] && freq <= freq_limit[GL5528][1])
    {
        return GL5528;
    }
    else if (freq >= freq_limit[MQ135][0] && freq <= freq_limit[MQ135][1])
    {
        return MQ135;
    }
    // else if (freq >= freq_limit[MQ3][0] && freq <= freq_limit[MQ3][1])
    // {
    //     return MQ3;
    // }
    // else if (freq >= freq_limit[MQ7][0] && freq <= freq_limit[MQ7][1])
    // {
    //     return MQ7;
    // }
    else if (freq >= freq_limit[HCSR04][0] && freq <= freq_limit[HCSR04][1])
    {
        return HCSR04;
    }
    // else if (freq >= freq_limit[CZN15E][0] && freq <= freq_limit[CZN15E][1])
    // {
    //     return CZN15E;
    // }
    // else if (freq >= freq_limit[MH1][0] && freq <= freq_limit[MH1][1])
    // {
    //     return MH1;
    // }
    // else if (freq >= freq_limit[BUTTON][0] && freq <= freq_limit[BUTTON][1])
    // {
    //     return BUTTON;
    // }
    else if (freq >= freq_limit[HOMESYNC][0] && freq <= freq_limit[HOMESYNC][1])
    {
        return HOMESYNC;
    }
    else
    {
        return NOT_DETECTED;
    }
};