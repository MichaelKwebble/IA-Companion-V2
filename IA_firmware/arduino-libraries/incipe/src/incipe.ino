#include "incipe.h"

void setup()
{
    /* SYSTEM CODE BEGIN 1 */
    incipe.init();
    /* SYSTEM CODE END 1 */
    Serial.begin(115200);
    /* USER CODE BEGIN 1 */

    /* USER CODE END 1 */
}

void loop()
{
    /* SYSTEM CODE BEGIN 2 */
    incipe.main();
    /* SYSTEM CODE END 2 */

    /* USER CODE BEGIN 2 */
    /* USER CODE END 2 */
}