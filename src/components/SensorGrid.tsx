import React from 'react';
import type { SensorPort } from '../types/sensor';
import { SENSOR_NAMES, PORT_POSITIONS } from '../types/sensor';
import './SensorGrid.css';

interface SensorGridProps {
    sensorData: SensorPort[];
}

const SENSOR_ICONS: Record<number, string> = {
    1: '💡',
    2: '🌡️',
    5: '📡',
    9: '🏠',
    [-2]: '❌'
};

const SensorGrid: React.FC<SensorGridProps> = ({ sensorData }) => {
    // Create a map for quick lookup
    const sensorMap = new Map(sensorData.map(s => [s.port, s]));

    return (
        <div className="sensor-grid-container">
            <div className="sensor-grid-header">
                🔌 Sensor Port Configuration
            </div>
            <div className="sensor-grid">
                {PORT_POSITIONS.map(({ port, label }) => {
                    const sensor = sensorMap.get(port);
                    const sensorType = sensor?.sensor ?? -2;
                    const sensorName = SENSOR_NAMES[sensorType] || 'Unknown';
                    const isConnected = sensorType !== -2;
                    const icon = SENSOR_ICONS[sensorType] || '❓';

                    return (
                        <div
                            key={port}
                            className={`sensor-port ${isConnected ? 'connected' : ''}`}
                        >
                            <div className="port-label">{label}</div>
                            <div className="port-number">Port {port}</div>
                            <div className="sensor-icon">{icon}</div>
                            <div className={`sensor-name ${!isConnected ? 'not-connected' : ''}`}>
                                {sensorName}
                            </div>
                            {sensor && isConnected && (
                                <div className="sensor-value">
                                    Value: {sensor.value.toFixed(2)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SensorGrid;
