#ifndef APPLICATION_H
#define APPLICATION_H

#if (ARDUINO >= 100)
#include "Arduino.h"
#else
#include "WProgram.h"
#include <avr/io.h>
#endif

class Application
{
public:
    void calculator(void);
    void guessing_game(void);
};
#endif