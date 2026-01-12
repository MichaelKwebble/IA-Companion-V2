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
    selectedBoard: { name: string; fqbn: string } | null;
    selectedPort: string | null;
    connectionMode: 'auto' | 'manual';
    showDevicePicker: boolean;
    setSelectedBoard: (board: { name: string; fqbn: string } | null) => void;
    setSelectedPort: (port: string | null) => void;
    setConnectionMode: (mode: 'auto' | 'manual') => void;
    setShowDevicePicker: (show: boolean) => void;
    manualConnect: () => Promise<void>;
    manualDisconnect: () => Promise<void>;
    refresh: () => void;
    connectToDevice: (device: ESP32Device) => Promise<any>;
    disconnect: () => Promise<void>;
    sendCommand: (command: string) => void;
    runTerminalCommand: (command: string) => void;
    flashCode: (code: string, usbSerial?: string, projectRoot?: string, currentFilePath?: string, isReadOnly?: boolean) => Promise<any>;
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
    const [selectedBoard, setSelectedBoard] = React.useState<{ name: string; fqbn: string } | null>(null);
    const [selectedPort, setSelectedPort] = React.useState<string | null>(null);
    const [connectionMode, setConnectionMode] = React.useState<'auto' | 'manual'>('auto');
    const [showDevicePicker, setShowDevicePicker] = React.useState(false);
    const lastAttemptedDeviceRef = useRef<string | null>(null);

    const manualConnect = useCallback(async () => {
        if (!selectedPort) return;
        setIsConnecting(true);
        try {
            await serialConnect({ portPath: selectedPort } as any);
        } catch (err) {
            console.error('[DeviceContext] Manual connect error:', err);
            setConnectionError((err as Error).message);
        } finally {
            setIsConnecting(false);
        }
    }, [selectedPort, serialConnect]);

    const manualDisconnect = useCallback(async () => {
        await disconnect();
        // Clear connection error so manual mode can reconnect when switching back to serial tab
        setConnectionError(null);
    }, [disconnect]);

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

    const flashCode = useCallback(async (code: string, usbSerial?: string, projectRoot?: string, currentFilePath?: string, isReadOnly?: boolean) => {
        setIsFlashing(true);

        try {
            const response = await fetch('http://localhost:3001/api/flash', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code,
                    usbSerial,
                    projectRoot,
                    currentFilePath,
                    isReadOnly,
                    fqbn: selectedBoard?.fqbn,
                    portPath: selectedPort
                })
            });
            const result = await response.json();

            // After successful flash in manual mode, reconnect to the serial port
            if (result.success && connectionMode === 'manual' && selectedPort) {
                console.log('[DeviceContext] Flash complete, reconnecting to serial port:', selectedPort);
                // Wait a bit for the device to reset after flashing
                setTimeout(async () => {
                    try {
                        await serialConnect({ portPath: selectedPort } as any);
                        console.log('[DeviceContext] Serial reconnected after flash');
                    } catch (err) {
                        console.error('[DeviceContext] Failed to reconnect after flash:', err);
                    }
                }, 1000);
            }

            return result;
        } catch (err) {
            console.error('[DeviceContext] Flash error:', err);
            return { success: false, error: (err as Error).message };
        } finally {
            setIsFlashing(false);
        }
    }, [selectedBoard, selectedPort, connectionMode, serialConnect]);

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
        // Only auto-connect in 'auto' mode
        if (connectionMode !== 'auto') return;

        // If we have multiple products and haven't picked one yet, show picker
        if (devices.length > 1 && !isConnected && !isConnecting && !isFlashing && !showDevicePicker && !lastAttemptedDeviceRef.current) {
            setShowDevicePicker(true);
            return;
        }

        // If we have exactly one device but are not connected, try to auto-connect
        // BUT NOT if a manual selection is in progress
        if (devices.length === 1 && !isConnected && !isConnecting && !isFlashing && !selectedPort) {
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
    }, [devices, isConnected, isConnecting, connectToDevice, connectionError, isFlashing, connectionMode, showDevicePicker]);

    // Manual mode connection logic
    useEffect(() => {
        if (connectionMode !== 'manual' || !selectedPort || isConnected || isConnecting || isFlashing) return;

        // In manual mode, we don't auto-connect here. The connection is triggered manually or by other components.
        // This useEffect ensures that if we ARE in manual mode and the port changes, we are ready for a manual connection.
    }, [connectionMode, selectedPort, isConnected, isConnecting, isFlashing]);

    // Monitor port availability for manual selection
    useEffect(() => {
        let missingCount = 0;
        const checkPortAvailability = async () => {
            if (!selectedPort || connectionMode !== 'manual' || isFlashing) return;

            try {
                const response = await fetch('http://localhost:3001/api/serial/ports');
                const data = await response.json();
                if (data.success) {
                    const portExists = data.ports.some((p: any) => p.path === selectedPort);
                    if (!portExists) {
                        missingCount++;
                        if (missingCount >= 3) { // Only clear after 3 consecutive failures (6 seconds)
                            console.log('[DeviceContext] Selected port confirmed unplugged:', selectedPort);
                            setSelectedPort(null);
                            setSelectedBoard(null);
                        }
                    } else {
                        missingCount = 0;
                    }
                }
            } catch (err) {
                console.error('[DeviceContext] Failed to check port availability:', err);
            }
        };

        const interval = setInterval(checkPortAvailability, 2000);
        return () => clearInterval(interval);
    }, [selectedPort, connectionMode, isFlashing]);

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
        selectedBoard,
        selectedPort,
        connectionMode,
        showDevicePicker,
        setSelectedBoard,
        setSelectedPort,
        setConnectionMode,
        setShowDevicePicker,
        manualConnect,
        manualDisconnect,
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
