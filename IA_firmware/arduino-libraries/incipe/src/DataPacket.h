#ifndef _DATAPACKET_
#define _DATAPACKET_

typedef struct
{
    int packet_id;
    uint8_t value;
    uint32_t timestamp;
    char device_id[16];
    bool status_flag;
} DataPacket;

#endif