#ifndef SENSORSYNC_H
#define SENSORSYNC_H
#if ARDUINO >= 100
#include "Arduino.h"
#else
#include "WProgram.h"
#endif

#include "module/sensor.h"

class SensorSync
{
private:
    const int timeMs = 1000;
    uint8_t pin;
    uint16_t freq;
    uint16_t freq_limit[10][2] = {{18, 28}, {34, 54}, {200, 300}, {1000, 1200}, {550, 650}, {64, 80}, {110, 150}, {370, 410}, {90, 100}, {700, 900}};
    // uint16_t freq_limit[10][2] = {{9, 12}, {19, 23}, {125, 145}, {660, 800}, {300, 400}, {27, 35}, {60, 80}, {160, 250}, {39, 55}, {850, 1000}};

    // 0. DHT11, Temperature and humidity module (62k 11.52Hz){9-12} firm
    // 1. GL5528, Light module (30K not yet tested, 23Hz){20,21,22}
    // 2. MQ135, MQ-series: air quality module (4.7k 138.5Hz {125, 145}) firm
    // 3. MQ3,MQ-series: methane, butane, LPG, humus PPM detection (470, 742 {660-720} firm
    // 4. MQ7,  MQ-series: carbon monoxide PPM detection 1.5k, 360 {310-390}
    // 5. HCSR04, Ultrasonic module (20k not yet tested){32,33,28,34}
    // 6. CZN15E, Microphone module (10k, 68.57Hz {62-71}) firm
    // 7. MH1, Flame detection (3K not yet tested){200,202,203,206,207,194,205} {173}
    // 8. BUTTON, Button module (15k 46.45Hz){40-48} firm
    // 9. HOMESYNC, HomeSync Module (1K, 480Hz){760,800} firm {783}
    // 10. MOTOR, Motor Driver Module (2k 288Hz){} firm
    // 62k 11.52Hz
    // 47k 15.16Hz
    // 30k 23.61Hz U
    // 20k 35.12Hz U
    // 15k 46.45Hz U
    // 10k 68.57Hz U
    // 4.7k 138.5Hz U
    // 3.6k 175.6Hz
    // 3k 205.7Hz U
    // 2k 288Hz
    // 1.5k 360Hz U
    // 1k 480Hz
    // 470 742.3Hz U
    // 220 1000Hz
    // 18 1390 Hz
public:
    SensorSync(void);
    ~SensorSync(void);
    SensorType getSensorType(int freq);
};
#endif