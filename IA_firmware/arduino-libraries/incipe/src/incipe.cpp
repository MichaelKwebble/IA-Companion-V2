#include "incipe.h"

Incipe incipe(true);
const int serverPort = 8080;

WiFiServer server(serverPort); // Actual memory allocation
WiFiClient client;

bool BLEInitialized = false;
// OneWire oneWire(ONE_WIRE_BUS);
// DallasTemperature tsensor(&oneWire);
// Incipe::private
/* useful private function */

void Incipe::sensorsync(uint16_t i)
{
    int Htime = -1;
    int Ltime = -1;
    float frequency = -1;
    if (activate)
    {
        // Serial.printf("ENTER {%i}\n", i);
        // Ltime = pulseIn(zpin[i], LOW, 200000);
        Htime = pulseIn(zpin[i], HIGH, 200000);
        // Serial.printf("Period = {%i}\n", Htime + Ltime);
        // Serial.printf("Period = {%i}\n", Htime);
        if (Htime == 0)
        {
            // Serial.println("TIMEOUT");
            zpin_data[i] = -1;
        }
        else
        {
            // Serial.println("Success");
            frequency = (1000000 / (Htime));
            if (frequency > 1200)
                zpin_data[i] = -1;
            else
            {
                // Serial.println((int)frequency);
                zpin_data[i] = (int)frequency;
            }
        }
    }
};

bool Incipe::equal(uint8_t previous_bits[4], uint8_t current_bits[4])
{
    bool flag = true;
    for (uint8_t i = 0; i < NUM_OF_BIT; ++i)
        flag &= (previous_bits[i] == current_bits[i]);
    return flag;
}

bool Incipe::connected(SensorType type)
{
    for (uint8_t i = 0; i < NUM_OF_SENSOR; i++)
    {
        if (sensor_type[i] == type)
            return true;
    }
    return false;
}

void Incipe::system_handler(void)
{
    // Serial.println("[");
    // step 1: update current pin data -> sensor type --> update sensor configuration
    for (uint16_t i = 0; i < NUM_OF_SENSOR; i++)
    {
        // sendSensorSyncJson(i, sensor_type[i], check[i], 1);
        // page control monitoring
        if (screenReadValue("page.val") == 0)
        {
            for (int i = 0; i < NUM_OF_SENSOR; ++i)
            {
                if (sensor_type_name[i] != "")
                {
                    String widget = "p" + static_cast<String>(i + 1) + sensor_type_name[i];
                    String txt = "p" + static_cast<String>(i + 1) + "_t1";
                    vis(widget, 1);
                    vis(txt, 1);
                    if (sensor_type[i] == DHT11)
                        onscreen(txt, (int)getTemperature());
                    else if (sensor_type[i] == GL5528)
                        onscreen(txt, (int)getLightIntensity());
                    else if (sensor_type[i] == MQ135)
                        onscreen(txt, (float)getPPM());
                    else if (sensor_type[i] == MQ3)
                        onscreen(txt, (int)getAlcoholPPM());
                    else if (sensor_type[i] == MQ7)
                        onscreen(txt, (int)getCOPPM());
                    else if (sensor_type[i] == HCSR04)
                        onscreen(txt, (int)getDistance());
                    else if (sensor_type[i] == CZN15E)
                        onscreen(txt, (int)getSoundIntensity());
                    else if (sensor_type[i] == MH1)
                        onscreen(txt, (int)getFlameIntensity());
                    else if (sensor_type[i] == BUTTON)
                        onscreen(txt, (int)getButtonResponse());
                }
            }
        }
        // full-port sensorsync
        Incipe::sensorsync(i);
        if (sensor_type[i] == sync.getSensorType(zpin_data[i]) && check[i] >= 2) // double confirm
        {
            String txt = "p" + static_cast<String>(i + 1) + "_t1";
            if (sensor_type[i] == DHT11)
                onscreen(txt, (int)getTemperature());
            else if (sensor_type[i] == GL5528)
                onscreen(txt, (int)getLightIntensity());
            else if (sensor_type[i] == MQ135)
                onscreen(txt, (float)getPPM());
            else if (sensor_type[i] == MQ3)
                onscreen(txt, (int)getAlcoholPPM());
            else if (sensor_type[i] == MQ7)
                onscreen(txt, (int)getCOPPM());
            else if (sensor_type[i] == HCSR04)
                onscreen(txt, (int)getDistance());
            else if (sensor_type[i] == CZN15E)
                onscreen(txt, (int)getSoundIntensity());
            else if (sensor_type[i] == MH1)
                onscreen(txt, (int)getFlameIntensity());
            else if (sensor_type[i] == BUTTON)
                onscreen(txt, (int)getButtonResponse());
            continue;
        }
        else
            sensor_type[i] = sync.getSensorType(zpin_data[i]);

        // case 1: i-th port disconnect from sensorsync chip
        if (sensor_type[i] == NOT_DETECTED)
        {
            String widget = "p" + static_cast<String>(i + 1) + sensor_type_name[i];
            String txt = "p" + static_cast<String>(i + 1) + "_t1";
            onscreen(txt, "");
            vis(widget, 0);
            vis(txt, 0);
            check[i] = 0; // reset check[i] array element variable
            if (sensor_type_name[i] != "")
            {
                sensor_type_name[i] = "";
                Serial.println(sensorJSON(check, sensor_type_name));
            }
            delete Incipe::sensor[i];
            Incipe::sensor[i] = nullptr;
        }
        // case 2: we first receive signal from sensorsync
        else if (sensor_type[i] != NOT_DETECTED && check[i] == 0)
        {
            // String widget = "p" + static_cast<String>(i + 1);
            // vis(widget, 1);
            check[i]++;
        }
        // case 3: we receive a confirmed signal, update SensorType  -> delete previous sensor -> new sensor
        else if (sensor_type[i] != NOT_DETECTED && check[i] == 1)
        {
            // delete Incipe::sensor[i];
            if (sensor_type[i] == DHT11)
            {
                Incipe::sensor[i] = new dht11(sensor_type[i], reading_pin[i][0], reading_pin[i][1]);
                sensor_type_name[i] = "_temp";
                String widget = "p" + static_cast<String>(i + 1) + sensor_type_name[i];
                vis(widget, 1);
                String txt = "p" + static_cast<String>(i + 1) + "_t1";
                vis(txt, 1);
                onscreen(txt, (int)getTemperature());
                check[i]++;
            }
            else if ((sensor_type[i] == GL5528))
            {
                Incipe::sensor[i] = new gl5528(sensor_type[i], reading_pin[i][0], reading_pin[i][1]);
                sensor_type_name[i] = "_light";
                String widget = "p" + static_cast<String>(i + 1) + sensor_type_name[i];
                vis(widget, 1);
                String txt = "p" + static_cast<String>(i + 1) + "_t1";
                vis(txt, 1);
                onscreen(txt, (int)getLightIntensity());
                Serial.println(sensorJSON(check, sensor_type_name));
                check[i]++;
            }
            else if (sensor_type[i] == MQ135)
            {
                Incipe::sensor[i] = new mq135(sensor_type[i], reading_pin[i][0], reading_pin[i][1]);
                sensor_type_name[i] = "_aq";
                String widget = "p" + static_cast<String>(i + 1) + sensor_type_name[i];
                vis(widget, 1);
                String txt = "p" + static_cast<String>(i + 1) + "_t1";
                vis(txt, 1);
                onscreen(txt, (int)getPPM());
                Serial.println(sensorJSON(check, sensor_type_name));
                check[i]++;
            }

            else if ((sensor_type[i] == HCSR04))
            {
                Incipe::sensor[i] = new Ultrasonic(sensor_type[i], reading_pin[i][0], reading_pin[i][1]);
                sensor_type_name[i] = "_ultrasonic";
                String widget = "p" + static_cast<String>(i + 1) + sensor_type_name[i];
                vis(widget, 1);
                String txt = "p" + static_cast<String>(i + 1) + "_t1";
                vis(txt, 1);
                onscreen(txt, (int)getDistance());
                Serial.println(sensorJSON(check, sensor_type_name));
                check[i]++;
            }

            else if ((sensor_type[i] == HOMESYNC))
            {
                sensor_type_name[i] = "_ir";
                String widget = "p" + static_cast<String>(i + 1) + sensor_type_name[i];
                vis(widget, 1);
                String txt = "p" + static_cast<String>(i + 1) + "_t1";
                vis(txt, 1);
                Serial.println(sensorJSON(check, sensor_type_name));
                check[i]++;
            }

            // else if ((sensor_type[i] == MQ3))
            // {
            //     Incipe::sensor[i] = new mq3(sensor_type[i], reading_pin[i][0], reading_pin[i][1]);
            //     sensor_type_name[i] = "_alcohol";
            //     String widget = "p" + static_cast<String>(i + 1) + sensor_type_name[i];
            //     vis(widget, 1);
            //     String txt = "p" + static_cast<String>(i + 1) + "_t1";
            //     vis(txt, 1);
            //     onscreen(txt, (int)getAlcoholPPM());
            //     Serial.println(sensorJSON(check, sensor_type_name));
            //     check[i]++;
            // }

            // else if ((sensor_type[i] == MQ7))
            // {
            //     Incipe::sensor[i] = new mq7(sensor_type[i], reading_pin[i][0], reading_pin[i][1]);
            //     sensor_type_name[i] = "_co";
            //     String widget = "p" + static_cast<String>(i + 1) + sensor_type_name[i];
            //     vis(widget, 1);
            //     String txt = "p" + static_cast<String>(i + 1) + "_t1";
            //     vis(txt, 1);
            //     onscreen(txt, (int)getCOPPM());
            //     Serial.println(sensorJSON(check, sensor_type_name));
            //     check[i]++;
            // }

            // else if ((sensor_type[i] == MH1))
            // {
            //     Incipe::sensor[i] = new Mh1(sensor_type[i], reading_pin[i][0], reading_pin[i][1]);
            //     sensor_type_name[i] = "_flame";
            //     String widget = "p" + static_cast<String>(i + 1) + sensor_type_name[i];
            //     vis(widget, 1);
            //     String txt = "p" + static_cast<String>(i + 1) + "_t1";
            //     vis(txt, 1);
            //     onscreen(txt, (int)getFlameIntensity());
            //     Serial.println(sensorJSON(check, sensor_type_name));
            //     check[i]++;
            // }

            // else if ((sensor_type[i] == CZN15E))
            // {
            //     Incipe::sensor[i] = new Microphone(sensor_type[i], reading_pin[i][0], reading_pin[i][1]);
            //     sensor_type_name[i] = "_sound";
            //     String widget = "p" + static_cast<String>(i + 1) + sensor_type_name[i];
            //     vis(widget, 1);
            //     String txt = "p" + static_cast<String>(i + 1) + "_t1";
            //     vis(txt, 1);
            //     onscreen(txt, (int)getSoundIntensity());
            //     Serial.println(sensorJSON(check, sensor_type_name));
            //     check[i]++;
            // }

            // else if ((sensor_type[i] == BUTTON))
            // {
            //     Incipe::sensor[i] = new Button(sensor_type[i], reading_pin[i][0], reading_pin[i][1]);
            //     sensor_type_name[i] = "_button";
            //     String widget = "p" + static_cast<String>(i + 1) + sensor_type_name[i];
            //     vis(widget, 1);
            //     String txt = "p" + static_cast<String>(i + 1) + "_t1";
            //     vis(txt, 1);
            //     onscreen(txt, (int)getButtonResponse());
            //     Serial.println(sensorJSON(check, sensor_type_name));
            //     check[i]++;
            // }
        }
        prev_zpin_data[i] = zpin_data[i];
        if (screenReadValue("page.val") == 0)
        {
            for (int i = 0; i < NUM_OF_SENSOR; ++i)
            {
                if (sensor_type_name[i] != "")
                {
                    String widget = "p" + static_cast<String>(i + 1) + sensor_type_name[i];
                    String txt = "p" + static_cast<String>(i + 1) + "_t1";
                    vis(widget, 1);
                    vis(txt, 1);
                    if (sensor_type[i] == DHT11)
                        onscreen(txt, (int)getTemperature());
                    else if (sensor_type[i] == GL5528)
                        onscreen(txt, (int)getLightIntensity());
                    else if (sensor_type[i] == MQ135)
                        onscreen(txt, (float)getPPM());
                    else if (sensor_type[i] == MQ3)
                        onscreen(txt, (int)getAlcoholPPM());
                    else if (sensor_type[i] == MQ7)
                        onscreen(txt, (int)getCOPPM());
                    else if (sensor_type[i] == HCSR04)
                        onscreen(txt, (int)getDistance());
                    else if (sensor_type[i] == CZN15E)
                        onscreen(txt, (int)getSoundIntensity());
                    else if (sensor_type[i] == MH1)
                        onscreen(txt, (int)getFlameIntensity());
                    else if (sensor_type[i] == BUTTON)
                        onscreen(txt, (int)getButtonResponse());
                }
            }
        }
    }
    // Serial.println("]");
}

void Incipe::sendSensorSyncJson(int port_number, SensorType token, int status, float value)
{
    Serial.print("\"port\":");
    Serial.print(port_number);
    Serial.print(",\"sensor\":");
    if (status == 0)
        Serial.print(status - 2);
    else if (status == 1)
        Serial.print(status - 2);
    else if (status == 2)
        Serial.print(token);
    Serial.print(",\"value\":");
    Serial.print(value);
    Serial.print("}");
    if (port_number < 3)
        Serial.println(",");
    else
        Serial.println();
}

String Incipe::sensorJSON(uint8_t c[4], String n[4])
{
    String j = "{\"status\":[";
    for (int i = 0; i < 4; i++)
    {
        j += String(c[i] >= 1 ? 1 : 0);
        if (i < 3)
            j += ",";
    }
    j += "],\"sensor_names\":[";
    for (int i = 0; i < 4; i++)
    {
        j += "\"";
        j += (n[i] == "") ? "not_detected" : n[i].substring(1);
        j += "\"";
        if (i < 3)
            j += ",";
    }
    j += "]}";
    return j;
}

void Incipe::mircofan_controller(bool flag) {
    // digitalWrite(Incipe::fpin, flag);
};

// Incipe::public
/* useful public function */
Incipe::Incipe(bool activate) : activate(activate)
{

    for (uint8_t i = 0; i < NUM_OF_SENSOR; i++)
        sensor[i] = nullptr;
}

Incipe::~Incipe()
{
    for (uint8_t i = 0; i < NUM_OF_SENSOR; i++)
    {
        delete sensor[i];
        sensor[i] = nullptr;
    }
}

void Incipe::init()
{
    if (activate)
    {
        screen.begin(9600);
        for (uint8_t sensor = 0; sensor < NUM_OF_SENSOR; sensor++)
        {
            pinMode(zpin[sensor], INPUT);
            for (uint8_t i = 0; i < 2; ++i)
                pinMode(reading_pin[sensor][i], INPUT);
        }
        // pinMode(fpin, OUTPUT);
        // mircofan_controller(true);
    }
};

// completed
void Incipe::main()
{
    // WiFi.mode(WIFI_OFF);
    if (activate)
    {
        // runSensorSync();
        Incipe::system_handler();
        // if (WiFi.isConnected())
        // {
        //     vis("wifi_on", 1);
        //     vis("wifi_off", 0);
        // }
    }
}

void Incipe::runSensorSync()
{
    for (uint16_t i = 0; i < NUM_OF_SENSOR; i++)
        Incipe::sensorsync(i);
}

// DHT sensor reading: Humidity
float Incipe::getHumidity() const
{
    if (activate)
    {
        for (uint8_t i = 0; i < NUM_OF_SENSOR; i++)
        {
            if (sensor_type[i] == DHT11 && sensor[i] != nullptr)
                return sensor[i]->reading(reading_pin[i][1], 0);
        }
        return -1; // if no DHT11 sensor detected
    }
    else
    {
        return -1; // if library is disable
    }
}

// DHT sensor reading: Temperature
float Incipe::getTemperature() const
{
    if (activate)
    {
        for (uint8_t i = 0; i < NUM_OF_SENSOR; i++)
        {
            if (sensor_type[i] == DHT11 && sensor[i] != nullptr)
                return sensor[i]->reading(reading_pin[i][1], 1);
        }
        return -1; // if no DHT11 sensor detected
    }
    else
    {
        return -1; // if library is disable
    }
};

float Incipe::getPPM() const
{
    if (activate)
    {
        for (uint8_t i = 0; i < NUM_OF_SENSOR; ++i)
        {
            if (sensor_type[i] == MQ135 && sensor[i] != nullptr)
                return sensor[i]->reading(reading_pin[i][0]);
        }
        return -1; // if no MQ135 sensor detected
    }
    else
    {
        return -1; // if library is disable
    }
};

float Incipe::getAlcoholPPM() const
{
    if (activate)
    {
        for (uint8_t i = 0; i < NUM_OF_SENSOR; ++i)
        {
            if (sensor_type[i] == MQ3 && sensor[i] != nullptr)
                return sensor[i]->reading();
        }
        return -1; // if no MQ135 sensor detected
    }
    else
    {
        return -1; // if library is disable
    }
};

float Incipe::getCOPPM() const
{
    if (activate)
    {
        for (uint8_t i = 0; i < NUM_OF_SENSOR; ++i)
        {
            if (sensor_type[i] == MQ7 && sensor[i] != nullptr)
                return sensor[i]->reading();
        }
        return -1; // if no MQ135 sensor detected
    }
    else
    {
        return -1; // if library is disable
    }
};

float Incipe::getCorrectedPPM(float temperature, float humidity) const
{
    if (activate)
    {
        if (temperature == -1 && humidity == -1)
        {
            return -1; // no DHT11 detected
        }
        bool dht11_connected = false;
        bool mq135_connected = false;
        uint8_t mq135_index = -1;
        for (uint8_t i = 0; i < NUM_OF_SENSOR; ++i)
        {
            if (sensor_type[i] == DHT11 && dht11_connected == false)
            {
                dht11_connected = true;
            }
            if (sensor_type[i] == MQ135 && mq135_connected == false)
            {
                mq135_connected = true;
                mq135_index = i;
            }
        }

        if (dht11_connected && mq135_connected)
            return sensor[mq135_index]->corrected_reading(reading_pin[mq135_index][0], temperature, humidity);
        else
            return -1;
    }
    else
    {
        return -1; // if library is disable
    }
}

float Incipe::getLightIntensity() const
{
    if (activate)
    {
        for (uint8_t i = 0; i < NUM_OF_SENSOR; ++i)
        {
            if (sensor_type[i] == GL5528 && sensor[i] != nullptr)
                return sensor[i]->reading(reading_pin[i][0]);
        }
        return -1; // if no GL5528 sensor detected
    }
    else
    {
        return -1; // if library is disable
    }
}

// Ultrasonic Sensor
float Incipe::getDistance() const
{
    if (activate)
    {
        for (uint8_t i = 0; i < 4; ++i)
        {
            if (sensor_type[i] == HCSR04 && sensor[i] != nullptr)
                return sensor[i]->reading();
        }
        return -1; // if no GL5528 sensor detected
    }
    else
    {
        return -1; // if library is disable
    }
}

// Flame sensor
float Incipe::getFlameIntensity() const
{
    if (activate)
    {
        for (uint8_t i = 0; i < NUM_OF_SENSOR; ++i)
        {
            if (sensor_type[i] == MH1 && sensor[i] != nullptr)
                return sensor[i]->reading();
        }
        return -1; // if no GL5528 sensor detected
    }
    else
    {
        return -1; // if library is disable
    }
}

// Flame sensor
float Incipe::getSoundIntensity() const
{
    if (activate)
    {
        for (uint8_t i = 0; i < NUM_OF_SENSOR; ++i)
        {
            if (sensor_type[i] == CZN15E && sensor[i] != nullptr)
                return sensor[i]->reading();
        }
        return -1; // if no GL5528 sensor detected
    }
    else
    {
        return -1; // if library is disable
    }
}

// Button module
float Incipe::getButtonResponse() const
{
    if (activate)
    {
        for (uint8_t i = 0; i < NUM_OF_SENSOR; ++i)
        {
            if (sensor_type[i] == BUTTON && sensor[i] != nullptr)
                return sensor[i]->reading();
        }
        return -1; // if no GL5528 sensor detected
    }
    else
    {
        return -1; // if library is disable
    }
}

// IA screen
void Incipe::onscreen(String txt_index, int data)
{
    if (activate)
    {
        String txt = "";
        txt = txt_index + ".txt=\"";
        Serial1.print(txt);
        Serial1.print(String(data));
        Serial1.print("\"");
        Serial1.write("\xFF\xFF\xFF");
    }
}

void Incipe::onscreen(String txt_index, float data)
{
    if (activate)
    {
        String txt = "";
        txt = txt_index + ".txt=\"";
        Serial1.print(txt);
        Serial1.print(String(data));
        Serial1.print("\"");
        Serial1.write("\xFF\xFF\xFF");
    }
}

void Incipe::onscreen(String txt_index, String text)
{
    if (activate)
    {
        String txt = "";
        txt = txt_index + ".txt=\"";
        Serial1.print(txt);
        Serial1.print(text);
        Serial1.print("\"");
        Serial1.write("\xFF\xFF\xFF");
    }
}

void Incipe::onscreen(String txt_index, long data)
{
    if (activate)
    {
        String txt = "";
        txt = txt_index + ".txt=\"";
        Serial1.print(txt);
        Serial1.print(String(data));
        Serial1.print("\"");
        Serial1.write("\xFF\xFF\xFF");
    }
}

int Incipe::screenReadValue(String component)
{
    if (activate)
        return screen.readNumber(component);
    else
        return -1;
}

String Incipe::screenReadString(String component)
{
    if (activate)
        return screen.readStr(component);
    else
        return "\0";
}

void Incipe::screenWriteValue(String component, uint32_t data)
{
    if (activate)
        screen.writeNum(component, data);
}

void Incipe::controlBrightness(float light_intensity)
{
    // TODO: if light sensor not connected, set to 50% brightness by default
    static int previous_data = 0;
    bool gl5528_connected = false;
    if (activate)
    {
        for (uint8_t i = 0; i < NUM_OF_SENSOR; i++)
        {
            if (sensor_type[i] == GL5528)
                gl5528_connected = true;
        }

        int current_data = gl5528_connected ? int(float((4096 - light_intensity) / 4096.0) * 100.0) : 220;
        if (gl5528_connected)
        {
            String txt = "dim=" + String(current_data < 120 ? 120 : current_data);
            screen.writeStr(txt);
        }
        else
        {
            String txt = "dim=" + String(55);
            screen.writeStr(txt);
        }
        previous_data = current_data;
    }
}

void Incipe::vis(String vis_component, bool activate)
{
    String command = "vis " + vis_component + "," + String(activate);
    Serial1.write(command.c_str());
    Serial1.print("\xFF\xFF\xFF");
};

void Incipe::screenMode(String option, uint32_t command)
{
    String mode = option + "=" + String(command);
    Serial1.write(mode.c_str());
    Serial1.print("\xFF\xFF\xFF");
};

void Incipe::listDir(fs::FS &fs, const char *dirname, uint8_t levels)
{
    Serial.printf("Listing directory: %s\n", dirname);

    File root = fs.open(dirname);
    if (!root)
    {
        Serial.println("Failed to open directory");
        return;
    }
    if (!root.isDirectory())
    {
        Serial.println("Not a directory");
        return;
    }

    File file = root.openNextFile();
    while (file)
    {
        if (file.isDirectory())
        {
            Serial.print("  DIR : ");
            Serial.println(file.name());
            if (levels)
            {
                listDir(fs, file.name(), levels - 1);
            }
        }
        else
        {
            Serial.print("  FILE: ");
            Serial.print(file.name());
            Serial.print("  SIZE: ");
            Serial.println(file.size());
        }
        file = root.openNextFile();
    }
}

void Incipe::createDir(fs::FS &fs, const char *path)
{
    Serial.printf("Creating Dir: %s\n", path);
    if (fs.mkdir(path))
    {
        Serial.println("Dir created");
    }
    else
    {
        Serial.println("mkdir failed");
    }
}

void Incipe::removeDir(fs::FS &fs, const char *path)
{
    Serial.printf("Removing Dir: %s\n", path);

    // Check if directory exists first
    if (!fs.exists(path))
    {
        Serial.println("Error: Directory does not exist");
        return;
    }

    // Check if it's actually a directory
    File root = fs.open(path);
    if (!root.isDirectory())
    {
        Serial.println("Error: Path is not a directory");
        root.close();
        return;
    }
    root.close();

    // Try to list contents (to check if empty)
    File file = fs.open(path);
    if (file)
    {
        int fileCount = 0;
        while (File entry = file.openNextFile())
        {
            fileCount++;
            Serial.printf("Found file/dir: %s\n", entry.name());
            entry.close();
        }
        if (fileCount > 0)
        {
            Serial.printf("Error: Directory contains %d items\n", fileCount);
            return;
        }
        file.close();
    }

    // Now attempt removal
    if (fs.rmdir(path))
    {
        Serial.println("Dir removed successfully");
    }
    else
    {
        Serial.println("rmdir failed");
        // Additional error information if available
        if (fs.exists(path))
        {
            Serial.println("Directory still exists after removal attempt");
        }
    }
}
void Incipe::readFile(fs::FS &fs, const char *path)
{
    Serial.printf("Reading file: %s\n", path);

    File file = fs.open(path);
    if (!file)
    {
        Serial.println("Failed to open file for reading");
        return;
    }

    Serial.print("Read from file: ");
    while (file.available())
    {
        Serial.write(file.read());
    }
    file.close();
}

void Incipe::writeFile(fs::FS &fs, const char *path, const char *message)
{
    Serial.printf("Writing file: %s\n", path);

    File file = fs.open(path, FILE_WRITE);
    if (!file)
    {
        Serial.println("Failed to open file for writing");
        return;
    }
    if (file.print(message))
    {
        Serial.println("File written");
    }
    else
    {
        Serial.println("Write failed");
    }
    file.close();
}

void Incipe::appendFile(fs::FS &fs, const char *path, const char *message)
{
    Serial.printf("Appending to file: %s\n", path);

    File file = fs.open(path, FILE_APPEND);
    if (!file)
    {
        Serial.println("Failed to open file for appending");
        return;
    }
    if (file.print(message))
    {
        Serial.println("Message appended");
    }
    else
    {
        Serial.println("Append failed");
    }
    file.close();
}

void Incipe::renameFile(fs::FS &fs, const char *path1, const char *path2)
{
    Serial.printf("Renaming file %s to %s\n", path1, path2);
    if (fs.rename(path1, path2))
    {
        Serial.println("File renamed");
    }
    else
    {
        Serial.println("Rename failed");
    }
}

void Incipe::deleteFile(fs::FS &fs, const char *path)
{
    Serial.printf("Deleting file: %s\n", path);
    if (fs.remove(path))
    {
        Serial.println("File deleted");
    }
    else
    {
        Serial.println("Delete failed");
    }
}

void Incipe::testFileIO(fs::FS &fs, const char *path)
{
    File file = fs.open(path);
    static uint8_t buf[512];
    size_t len = 0;
    uint32_t start = millis();
    uint32_t end = start;
    if (file)
    {
        len = file.size();
        size_t flen = len;
        start = millis();
        while (len)
        {
            size_t toRead = len;
            if (toRead > 512)
            {
                toRead = 512;
            }
            file.read(buf, toRead);
            len -= toRead;
        }
        end = millis() - start;
        Serial.printf("%u bytes read for %u ms\n", flen, end);
        file.close();
    }
    else
    {
        Serial.println("Failed to open file for reading");
    }

    file = fs.open(path, FILE_WRITE);
    if (!file)
    {
        Serial.println("Failed to open file for writing");
        return;
    }

    size_t i;
    start = millis();
    for (i = 0; i < 2048; i++)
    {
        file.write(buf, 512);
    }
    end = millis() - start;
    Serial.printf("%u bytes written for %u ms\n", 2048 * 512, end);
    file.close();
};

void Incipe::testSDCard()
{
    // hspi->begin(HSPI_SCLK, HSPI_MISO, HSPI_MOSI, HSPI_SS); // Use your CS pin
    // hspi->setFrequency(4000000);
    if (!SD.begin(HSPI_SS))
    {
        Serial.println("Card Failed");
        return;
    }
    uint8_t cardType = SD.cardType();

    if (cardType == CARD_NONE)
    {
        Serial.println("SD card not attached");
        return;
    }

    Serial.print("SD Card Type: ");
    if (cardType == CARD_MMC)
    {
        Serial.println("MMC");
    }
    else if (cardType == CARD_SD)
    {
        Serial.println("SDSC");
    }
    else if (cardType == CARD_SDHC)
    {
        Serial.println("SDHC");
    }
    else
    {
        Serial.println("UNKNOWN");
    }

    uint64_t cardSize = SD.cardSize() / (1024 * 1024);
    Serial.printf("SD Card Size: %lluMB\n", cardSize);
    createDir(SD, "/mydir");
    writeFile(SD, "/mydir/hello.txt", "ABC");
    readFile(SD, "/mydir/hello.txt");
    deleteFile(SD, "/mydir/hello.txt");
    removeDir(SD, "/mydir");
    listDir(SD, "/mydir", 0); // should show fail
    writeFile(SD, "/hello.txt", "INCIPE ");
    appendFile(SD, "/hello.txt", "World!\n");
    readFile(SD, "/hello.txt");
    deleteFile(SD, "/signal.txt");
    renameFile(SD, "/hello.txt", "/signal.txt");
    readFile(SD, "/signal.txt");
    // testFileIO(SD, "/test.txt");
    Serial.printf("Total space: %lluMB\n", SD.totalBytes() / (1024 * 1024));
    Serial.printf("Used space: %lluMB\n", SD.usedBytes() / (1024 * 1024));
    // appendFile(SD, "/mydir/incipe.html", "incipe.ino");
    // appendFile(SD, "/mydir/hello.txt", "incipe.cpp");
    listDir(SD, "/", 0);
}

// IA screen testing function
void Incipe::screenTest()
{
    /* Screen Test*/
    int i = 0;
    vis("w_alcohol", i);
    vis("w_temp", i);
    vis("w_light", i);
    vis("w_aq", i);
    vis("w_button", i);
    vis("w_flame", i);
    vis("w_co", i);
    vis("w_ir", i);
    vis("w_sound", i);
    vis("w_ultrasonic", i);
    screenMode("dims", i * 50);
}

void Incipe::switchPage(int page_num)
{
    String page = "";
    String a = static_cast<String>(page_num);
    page = "page " + a + "\xFF\xFF\xFF";
    Serial1.print(page);
    Serial1.write(0xff);
    Serial1.write(0xff);
    Serial1.write(0xff);
};

// WiFi API

// Connect to WiFi with status feedback
void Incipe::connectToWiFi(const char *ssid, const char *password, bool isServer)
{
    Serial.println("Connecting to WiFi...");
    Incipe::ssid = ssid;
    Incipe::password = password;
    WiFi.begin(ssid, password);

    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
        Serial.print(".");
    }

    Serial.println("\nWiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());

    if (isServer)
        server.begin();
}

// Simple WiFi scanner
void Incipe::scanWiFiNetworks()
{
    Serial.println("Scanning WiFi networks...");

    int numNetworks = WiFi.scanNetworks();

    if (numNetworks == 0)
    {
        Serial.println("No networks found");
    }
    else
    {
        Serial.print(numNetworks);
        Serial.println(" networks found:");

        for (int i = 0; i < numNetworks; i++)
        {
            Serial.print(i + 1);
            Serial.print(": ");
            Serial.print(WiFi.SSID(i));
            Serial.print(" (");
            Serial.print(WiFi.RSSI(i));
            Serial.print(" dBm) ");
            Serial.println((WiFi.encryptionType(i) == WIFI_AUTH_OPEN) ? "Open" : "Protected");
        }
    }
}

// Get WiFi connection status as string
String Incipe::getWiFiStatus()
{
    switch (WiFi.status())
    {
    case WL_IDLE_STATUS:
        return "Idle";
    case WL_NO_SSID_AVAIL:
        return "No SSID Available";
    case WL_SCAN_COMPLETED:
        return "Scan Completed";
    case WL_CONNECTED:
        return "Connected";
    case WL_CONNECT_FAILED:
        return "Connection Failed";
    case WL_CONNECTION_LOST:
        return "Connection Lost";
    case WL_DISCONNECTED:
        return "Disconnected";
    default:
        return "Unknown";
    }
}

void Incipe::handleClient(DataPacket &packet)
{
    static unsigned long lastActivityTime = millis();

    // 1. Check for new client if current one disconnected
    if (!client || !client.connected())
    {
        client.stop();
        client = server.available();
        if (client)
        {
            Serial.println("New client: " + client.remoteIP().toString());
            lastActivityTime = millis();
            client.setTimeout(3000);
        }
        return;
    }

    // 2. Check for connection timeout (10 seconds)
    if (millis() - lastActivityTime > 10000)
    {
        Serial.println("Connection timeout (10s) - disconnecting");
        client.stop();
        return;
    }

    // 3. Handle incoming data
    if (client.available() >= sizeof(DataPacket))
    {
        memset(&packet, 0, sizeof(packet));
        size_t bytesRead = client.readBytes((char *)&packet, sizeof(packet));
        lastActivityTime = millis();

        if (bytesRead == sizeof(packet))
        {
            // Packet successfully received, send ACK
            if (client.connected() &&
                client.write((uint8_t *)&packet.packet_id, sizeof(packet.packet_id)) != sizeof(packet.packet_id))
            {
                Serial.println("ACK send failed");
                client.stop();
            }
        }
        else
        {
            Serial.println("Incomplete packet");
            client.stop();
        }
    }
}

bool Incipe::connectToServer(const char *serverIP)
{
    client.stop();
    delay(200);
    client.flush();

    if (!client.connect(serverIP, serverPort))
    {
        Serial.println("Connection failed");
        return false;
    }

    // Wait for connection to stabilize
    unsigned long start = millis();
    while (!client.connected() && millis() - start < 2000)
    {
        delay(10);
    }

    if (client.connected())
    {
        Serial.println("Server connection established");
        return true;
    }
    return false;
}

void Incipe::sendDataToServer(const char *serverIP, DataPacket &packet)
{
    if (!client.connected())
    {
        if (!connectToServer(serverIP))
        {
            Serial.println("Reconnecting WiFi...");
            connectToWiFi(ssid, password);
            return;
        }
    }
    // Send the struct as binary data
    client.write((uint8_t *)&packet, sizeof(packet));
    Serial.println("Sent data packet");
    // Wait for acknowledgment
    waitForAck();
}

void Incipe::waitForAck()
{
    unsigned long start = millis();
    while (client.available() < sizeof(uint16_t) && millis() - start < 2000)
    {
        delay(10);
    }

    if (client.available() >= sizeof(uint16_t))
    {
        Serial.println("WiFi & Server Connect");
        uint16_t ackId;
        client.read((uint8_t *)&ackId, sizeof(ackId));
        Serial.printf("Received ACK for packet %d\n", ackId);
    }
    else
    {
        Serial.println("WiFi & Server Disconnect");
    }
}

// Bluetooth API
// Simple BLE Server setup
void setupBLEServer(const char *deviceName)
{
    BLEDevice::init(deviceName);
    BLEServer *pServer = BLEDevice::createServer();

    // Create a service
    BLEService *pService = pServer->createService(BLEUUID((uint16_t)0x180F)); // Battery Service

    // Create a characteristic
    BLECharacteristic *pCharacteristic = pService->createCharacteristic(
        BLEUUID((uint16_t)0x2A19),
        BLECharacteristic::PROPERTY_READ |
            BLECharacteristic::PROPERTY_NOTIFY);

    pService->start();

    // Start advertising
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(pService->getUUID());
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06); // helps with iPhone connections
    BLEDevice::startAdvertising();

    Serial.println("BLE Server started!");
    Serial.print("Device name: ");
    Serial.println(deviceName);
}

// Simple BLE Scanner
void scanBLEDevices(int scanTime)
{
    BLEDevice::init("");
    BLEScan *pBLEScan = BLEDevice::getScan();
    pBLEScan->setActiveScan(true);
    pBLEScan->setInterval(100);
    pBLEScan->setWindow(99);

    Serial.println("Scanning BLE devices...");

    // The key fix: store the pointer, not the value
    BLEScanResults *pResults = pBLEScan->start(scanTime, false);

    Serial.print("Found ");
    Serial.print(pResults->getCount());
    Serial.println(" device(s):");

    for (int i = 0; i < pResults->getCount(); i++)
    {
        BLEAdvertisedDevice device = pResults->getDevice(i);
        Serial.printf("%d: %s (%s) RSSI: %d\n",
                      i + 1,
                      device.haveName() ? device.getName().c_str() : "Unknown",
                      device.getAddress().toString().c_str(),
                      device.getRSSI());
    }

    pBLEScan->clearResults();
}