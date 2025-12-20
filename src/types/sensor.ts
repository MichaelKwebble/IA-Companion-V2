export interface SensorPort {
    port: number;
    sensor: number;
    value: number;
}

export interface SensorConfig {
    ports: SensorPort[];
}

export const SENSOR_NAMES: Record<number, string> = {
    1: 'Light Sensor',
    2: 'AQ Sensor',
    5: 'Ultrasonic Sensor',
    9: 'Sensor 9',
    [-1]: 'Empty Port',
    [-2]: 'Empty Port'
};

export const PORT_POSITIONS = [
    { port: 0, label: 'Top Left' },
    { port: 1, label: 'Top Right' },
    { port: 2, label: 'Bottom Left' },
    { port: 3, label: 'Bottom Right' }
];
