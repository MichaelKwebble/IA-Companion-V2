// #include "incipe.h"

void setup () {
  // incipe.init();
  Serial.begin(115200);
}

void loop () {
  // incipe.main();
  Serial.println("hello world!");
  delay(100);
}