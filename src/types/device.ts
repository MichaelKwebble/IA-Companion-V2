export interface ESP32Device {
    usbSerial: string;
    vendorId: number;
    productId: number;
    deviceName: string;
    detectedAt: string;
}

export interface DeviceResponse {
    success: boolean;
    count: number;
    devices: ESP32Device[];
    error?: string;
}
