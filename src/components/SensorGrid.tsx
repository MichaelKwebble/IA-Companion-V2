import React from 'react';
import type { SensorPort } from '../types/sensor';
import { SENSOR_NAMES, PORT_POSITIONS } from '../types/sensor';
import './SensorGrid.css';

interface SensorGridProps {
    sensorData: SensorPort[];
}

const SENSOR_LOGOS: Record<number, string> = {
    1: '/assets/sensors/light.png',
    2: '/assets/sensors/aq.png',
    5: '/assets/sensors/ultrasonic.png',
    9: '/assets/sensors/sensor9.png'
};

const SensorGrid: React.FC<SensorGridProps> = ({ sensorData }) => {
    // Create a map for quick lookup
    const sensorMap = new Map(sensorData.map(s => [s.port, s]));

    return (
        <div className="sensor-grid-container">
            <div className="sensor-grid-header">
                <div className="header-icon">🔌</div>
                <div className="header-text">
                    <h3>Sensor Port Configuration</h3>
                    <p>Real-time hardware status</p>
                </div>
            </div>
            <div className="sensor-grid">
                {PORT_POSITIONS.map(({ port, label }) => {
                    const sensor = sensorMap.get(port);
                    const sensorType = sensor?.sensor ?? -2;
                    const isConnected = sensorType !== -1 && sensorType !== -2;
                    const sensorName = isConnected ? SENSOR_NAMES[sensorType] || 'Unknown Sensor' : 'Empty Port';
                    const logo = SENSOR_LOGOS[sensorType];

                    return (
                        <div
                            key={port}
                            className={`sensor-port-card ${isConnected ? 'connected' : 'empty'}`}
                        >
                            <div className="port-badge">Port {port}</div>
                            <div className="port-location">{label}</div>

                            <div className="sensor-visual">
                                {isConnected && logo ? (
                                    <img src={logo} alt={sensorName} className="sensor-logo-img" />
                                ) : (
                                    <div className="empty-slot-icon">
                                        {isConnected ? '❓' : '🔌'}
                                    </div>
                                )}
                            </div>

                            <div className="sensor-info">
                                <div className={`sensor-status-dot ${isConnected ? 'active' : ''}`} />
                                <span className="sensor-name-text">{sensorName}</span>
                            </div>

                            {isConnected && sensor && (
                                <div className="sensor-data-badge">
                                    <span className="data-label">Value</span>
                                    <span className="data-value">{sensor.value.toFixed(2)}</span>
                                </div>
                            )}

                            {!isConnected && (
                                <div className="waiting-text">Waiting for connection...</div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SensorGrid;
