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
    isFlashing: boolean;
    flashProgress: number;
    flashMessage: string;
    serialData: string[];
    terminalLogs: string[];
    arduinoLogs: { text: string; isError?: boolean }[];
    arduinoStatus: { status: 'success' | 'error' | 'starting'; id: string; message: string; timestamp: number } | null;
    sensorConfig: any[];
    refresh: () => void;
    connectToDevice: (device: ESP32Device) => Promise<any>;
    disconnect: () => Promise<void>;
    sendCommand: (command: string) => void;
    runTerminalCommand: (command: string) => void;
    flashCode: (code: string, usbSerial: string, projectRoot?: string, currentFilePath?: string, isReadOnly?: boolean) => Promise<any>;
    cancelFlash: () => Promise<void>;
    clearLog: () => void;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { devices, isLoading, error, refresh } = useDeviceDetection();
    const {
        isConnected,
        connectedDevice,
        serialData,
        terminalLogs,
        flashProgress,
        flashMessage,
        sensorConfig,
        arduinoLogs,
        arduinoStatus,
        connectToDevice: serialConnect,
        disconnect,
        sendCommand,
        runTerminalCommand,
        clearLog
    } = useSerialMonitor();

    const [connectionError, setConnectionError] = React.useState<string | null>(null);
    const [isConnecting, setIsConnecting] = React.useState(false);
    const [isFlashing, setIsFlashing] = React.useState(false);
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

    const flashCode = useCallback(async (code: string, usbSerial: string, projectRoot?: string, currentFilePath?: string, isReadOnly?: boolean) => {
        setIsFlashing(true);

        try {
            const response = await fetch('http://localhost:3001/api/flash', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, usbSerial, projectRoot, currentFilePath, isReadOnly })
            });
            const result = await response.json();
            return result;
        } catch (err) {
            console.error('[DeviceContext] Flash error:', err);
            return { success: false, error: (err as Error).message };
        } finally {
            setIsFlashing(false);
        }
    }, []);

    const cancelFlash = useCallback(async () => {
        try {
            await fetch('http://localhost:3001/api/flash/cancel', { method: 'POST' });
            setIsFlashing(false);
        } catch (err) {
            console.error('[DeviceContext] Cancel error:', err);
        }
    }, []);

    // Global auto-connect logic - works from any page
    useEffect(() => {
        // If we have devices but are not connected, try to auto-connect
        if (devices.length > 0 && !isConnected && !isConnecting && !isFlashing) {
            const firstDevice = devices[0];

            // If we have a connection error, we only retry if the device list just changed (replugged)
            // or if we haven't tried this specific device yet.
            if (!connectionError || lastAttemptedDeviceRef.current !== firstDevice.usbSerial) {
                console.log('[DeviceProvider] Auto-connecting to device:', firstDevice);
                connectToDevice(firstDevice);
            }
        }

        // Reset connection error and last attempted device if all devices are removed
        // This allows auto-connect to trigger again when a device is replugged
        if (devices.length === 0) {
            if (connectionError) setConnectionError(null);
            if (lastAttemptedDeviceRef.current) lastAttemptedDeviceRef.current = null;
        }
    }, [devices, isConnected, isConnecting, connectToDevice, connectionError, isFlashing]);

    const value: DeviceContextType = {
        devices,
        isConnected,
        connectedDevice,
        isLoading,
        error,
        connectionError,
        isConnecting,
        isFlashing,
        flashProgress,
        flashMessage,
        serialData,
        terminalLogs,
        arduinoLogs,
        arduinoStatus,
        sensorConfig,
        refresh,
        connectToDevice,
        disconnect,
        sendCommand,
        runTerminalCommand,
        flashCode,
        cancelFlash,
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
