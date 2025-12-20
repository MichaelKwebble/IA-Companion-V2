import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { useDeviceDetection } from '../hooks/useDeviceDetection';
import { useSerialMonitor } from '../hooks/useSerialMonitor';
import type { ESP32Device } from '../types/device';

interface DeviceContextType {
    devices: ESP32Device[];
    isConnected: boolean;
    connectedDevice: ESP32Device | null;
    isLoading: boolean;
    error: string | null;
    connectionError: string | null;
    isConnecting: boolean;
    serialData: string[];
    sensorConfig: any[];
    refresh: () => void;
    connectToDevice: (device: ESP32Device) => Promise<any>;
    disconnect: () => Promise<void>;
    sendCommand: (command: string) => void;
    clearLog: () => void;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { devices, isLoading, error, refresh } = useDeviceDetection();
    const {
        isConnected,
        connectedDevice,
        serialData,
        sensorConfig,
        connectToDevice: serialConnect,
        disconnect,
        sendCommand,
        clearLog
    } = useSerialMonitor();

    const [connectionError, setConnectionError] = React.useState<string | null>(null);
    const [isConnecting, setIsConnecting] = React.useState(false);
    const lastAttemptedDeviceRef = useRef<string | null>(null);

    const connectToDevice = useCallback(async (device: ESP32Device) => {
        setIsConnecting(true);
        setConnectionError(null);
        lastAttemptedDeviceRef.current = device.usbSerial;
        try {
            const result = await serialConnect(device);
            if (!result.success) {
                setConnectionError(result.error || 'Failed to connect to serial port');
            }
            return result;
        } catch (err) {
            const errorMsg = (err as Error).message;
            setConnectionError(errorMsg);
            return { success: false, error: errorMsg };
        } finally {
            setIsConnecting(false);
        }
    }, [serialConnect]);

    // Global auto-connect logic - works from any page
    useEffect(() => {
        if (devices.length > 0 && !isConnected && !isConnecting && !connectionError) {
            const firstDevice = devices[0];
            // Only auto-connect if we haven't already tried this device or if it's a different device
            if (lastAttemptedDeviceRef.current !== firstDevice.usbSerial || !connectedDevice) {
                console.log('[DeviceProvider] Auto-connecting to device:', firstDevice);
                connectToDevice(firstDevice);
            }
        }

        // Reset connection error if device is removed
        if (devices.length === 0 && connectionError) {
            setConnectionError(null);
            lastAttemptedDeviceRef.current = null;
        }
    }, [devices, isConnected, isConnecting, connectedDevice, connectToDevice, connectionError]);

    const value: DeviceContextType = {
        devices,
        isConnected,
        connectedDevice,
        isLoading,
        error,
        connectionError,
        isConnecting,
        serialData,
        sensorConfig,
        refresh,
        connectToDevice,
        disconnect,
        sendCommand,
        clearLog
    };

    return (
        <DeviceContext.Provider value={value}>
            {children}
        </DeviceContext.Provider>
    );
};

export const useDevice = () => {
    const context = useContext(DeviceContext);
    if (context === undefined) {
        throw new Error('useDevice must be used within a DeviceProvider');
    }
    return context;
};
