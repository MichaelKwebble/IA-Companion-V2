import React from 'react';
import { useDevice } from '../context/DeviceContext';
import SensorGrid from '../components/SensorGrid';
import { RefreshCw, AlertTriangle, Link, Search } from 'lucide-react';
import '../styles/DeviceDetection.css';

const Home: React.FC = () => {
    const {
        devices,
        isLoading,
        error,
        connectionError,
        isConnected,
        connectedDevice,
        isConnecting,
        refresh,
        connectToDevice,
        sensorConfig
    } = useDevice();

    const lastUpdate = new Date(); // lastUpdate is no longer provided by useDeviceDetection, so we create a new one or remove if not needed. Assuming it's for display purposes.

    return (
        <div className="p-md">
            <div className="dashboard-header">
                <div>
                    <h1>Welcome to IA Companion V2</h1>
                    <p className="dashboard-subtitle">Select a tab from the sidebar to get started.</p>
                </div>
            </div>

            {/* Device Detection Section */}
            <div className="device-detection-container">
                <div className="device-detection-header">
                    <h2>ESP32-S3 Device Detection</h2>
                    <button onClick={refresh} className="refresh-btn" disabled={isLoading}>
                        <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
                        {isLoading ? 'Scanning...' : 'Refresh'}
                    </button>
                </div>

                {error && (
                    <div className="device-error">
                        <span className="error-icon"><AlertTriangle size={20} /></span>
                        <span>Error: {error}</span>
                        <p className="error-hint">Make sure the backend server is running on port 3001</p>
                    </div>
                )}

                {connectionError && (
                    <div className="device-error">
                        <span className="error-icon"><AlertTriangle size={20} /></span>
                        <span>Serial Connection Error: {connectionError}</span>
                        {devices.length > 0 && (
                            <button
                                onClick={() => connectToDevice(devices[0])}
                                className="refresh-btn"
                                style={{ marginTop: '0.5rem' }}
                                disabled={isConnecting}
                            >
                                <RefreshCw size={14} className={isConnecting ? 'spin' : ''} />
                                {isConnecting ? 'Connecting...' : 'Retry Connection'}
                            </button>
                        )}
                    </div>
                )}

                {!error && (
                    <>
                        <div className="device-status">
                            <span className={`status-indicator ${devices.length > 0 ? 'connected' : 'disconnected'}`}>
                                {devices.length > 0 ? '● Connected' : '○ No devices'}
                            </span>
                            <span className="device-count">
                                {devices.length} device{devices.length !== 1 ? 's' : ''} detected
                            </span>
                            {isConnected ? (
                                <span className="status-indicator connected flex items-center gap-xs">
                                    <Link size={14} /> Serial Connected
                                </span>
                            ) : devices.length > 0 && (
                                <button
                                    onClick={() => connectToDevice(devices[0])}
                                    className="refresh-btn"
                                    style={{ marginLeft: '1rem', padding: '4px 12px', fontSize: '0.85rem' }}
                                    disabled={isConnecting}
                                >
                                    {isConnecting ? (
                                        <>
                                            <RefreshCw size={14} className="spin" /> Connecting...
                                        </>
                                    ) : (
                                        <>
                                            <Link size={14} /> Reconnect
                                        </>
                                    )}
                                </button>
                            )}
                            {lastUpdate && (
                                <span className="last-update">
                                    Last update: {lastUpdate.toLocaleTimeString()}
                                </span>
                            )}
                        </div>

                        {devices.length === 0 ? (
                            <div className="no-devices">
                                <div className="no-devices-icon"><Search size={48} /></div>
                                <h3>No ESP32-S3 devices found</h3>
                                <p>Connect an ESP32-S3 device via USB to get started</p>
                                <div className="detection-info">
                                    <p><strong>Looking for:</strong></p>
                                    <ul>
                                        <li>Vendor ID: 0x303A (Espressif)</li>
                                        <li>Product ID: 0x1001</li>
                                    </ul>
                                </div>
                            </div>
                        ) : (
                            <div className="device-list">
                                {devices.map((device, index) => (
                                    <div key={device.usbSerial} className="device-card">
                                        <div className="device-card-header">
                                            <span className="device-number">Device #{index + 1}</span>
                                            <span className="device-status-badge">
                                                {connectedDevice?.usbSerial === device.usbSerial ? 'Connected' : 'Active'}
                                            </span>
                                        </div>
                                        <div className="device-details">
                                            <div className="device-detail-row">
                                                <span className="detail-label">USB Serial:</span>
                                                <span className="detail-value serial">{device.usbSerial}</span>
                                            </div>
                                            <div className="device-detail-row">
                                                <span className="detail-label">Vendor ID:</span>
                                                <span className="detail-value">0x{device.vendorId.toString(16).toUpperCase().padStart(4, '0')}</span>
                                            </div>
                                            <div className="device-detail-row">
                                                <span className="detail-label">Product ID:</span>
                                                <span className="detail-value">0x{device.productId.toString(16).toUpperCase().padStart(4, '0')}</span>
                                            </div>
                                            <div className="device-detail-row">
                                                <span className="detail-label">Device Name:</span>
                                                <span className="detail-value">{device.deviceName}</span>
                                            </div>
                                            <div className="device-detail-row">
                                                <span className="detail-label">Detected At:</span>
                                                <span className="detail-value">
                                                    {new Date(device.detectedAt).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Sensor Grid Section */}
            {isConnected && (
                <div className="sensor-section">
                    <SensorGrid sensorData={sensorConfig} />
                    {sensorConfig.length === 0 && (
                        <div className="sensor-waiting-overlay">
                            <div className="spinner"></div>
                            <p>Waiting for sensor data from kit...</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Home;
