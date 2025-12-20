import { useState, useEffect, useCallback, useRef } from 'react';
import type { ESP32Device } from '../types/device';
import type { SensorPort } from '../types/sensor';

interface SerialMessage {
    type: 'serial-data' | 'serial-status' | 'serial-error';
    data?: string;
    status?: 'connected' | 'disconnected';
    device?: ESP32Device;
    error?: string;
    timestamp?: string;
}

// Global WebSocket instance - singleton pattern using window to survive HMR
const getGlobalWs = () => (window as any).__SERIAL_WS__ as WebSocket | null;
const setGlobalWs = (ws: WebSocket | null) => (window as any).__SERIAL_WS__ = ws;

const getWsListeners = () => {
    if (!(window as any).__SERIAL_LISTENERS__) {
        (window as any).__SERIAL_LISTENERS__ = new Set();
    }
    return (window as any).__SERIAL_LISTENERS__ as Set<(message: SerialMessage) => void>;
};

let reconnectTimeout: number | null = null;

function connectGlobalWebSocket() {
    const globalWs = getGlobalWs();
    // Prevent multiple connections
    if (globalWs && (globalWs.readyState === WebSocket.OPEN || globalWs.readyState === WebSocket.CONNECTING)) {
        return;
    }

    console.log('[WebSocket] Creating global connection...');

    const ws = new WebSocket('ws://localhost:3001');
    setGlobalWs(ws);

    ws.onopen = () => {
        console.log('[WebSocket] Global connection established');
    };

    ws.onmessage = (event) => {
        try {
            const message: SerialMessage = JSON.parse(event.data);
            // Broadcast to all listeners
            getWsListeners().forEach(listener => listener(message));
        } catch (error) {
            console.error('[WebSocket] Error parsing message:', error);
        }
    };

    ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
    };

    ws.onclose = () => {
        console.log('[WebSocket] Global connection closed');
        setGlobalWs(null);

        // Clear any existing reconnect timeout
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
        }

        // Attempt to reconnect after 3 seconds
        reconnectTimeout = window.setTimeout(() => {
            const currentWs = getGlobalWs();
            if (!currentWs || currentWs.readyState !== WebSocket.OPEN) {
                connectGlobalWebSocket();
            }
        }, 3000);
    };
}

export function useSerialMonitor() {
    const [isConnected, setIsConnected] = useState(false);
    const [serialData, setSerialData] = useState<string[]>([]);
    const [sensorConfig, setSensorConfig] = useState<SensorPort[]>([]);
    const [connectedDevice, setConnectedDevice] = useState<ESP32Device | null>(null);
    const bufferRef = useRef<string>('');

    const parseJsonData = useCallback((data: string) => {
        try {
            // Check if this line completes a JSON array
            bufferRef.current += data;

            // Look for complete JSON array pattern
            if (bufferRef.current.includes('[') && bufferRef.current.includes(']')) {
                // Extract all JSON-like content
                const jsonMatch = bufferRef.current.match(/\[[\s\S]*?\]/);
                if (jsonMatch) {
                    const jsonStr = jsonMatch[0];

                    // Clean up the JSON string - remove timestamps and fix formatting
                    const cleanJson = jsonStr
                        .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s*->\s*/g, '') // Remove timestamps
                        .replace(/\}\s*,?\s*{/g, '},{')  // Fix object separators
                        .replace(/"\s*(\w+)"\s*:/g, '"$1":') // Ensure proper key formatting
                        .replace(/,\s*]/g, ']'); // Remove trailing commas

                    console.log('[Serial Parser] Cleaned JSON:', cleanJson);

                    const parsed = JSON.parse(cleanJson);
                    if (Array.isArray(parsed)) {
                        setSensorConfig(parsed);
                        console.log('[Serial Parser] Updated sensor config:', parsed);
                    }

                    bufferRef.current = ''; // Clear buffer after successful parse
                }
            }
        } catch (error) {
            console.error('[Serial Parser] Error parsing JSON:', error);
            // If parsing fails and buffer is getting large, reset it
            if (bufferRef.current.length > 1000) {
                bufferRef.current = '';
            }
        }
    }, []);

    const connectToDevice = useCallback(async (device: ESP32Device) => {
        try {
            const response = await fetch('http://localhost:3001/api/serial/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ device })
            });

            const result = await response.json();
            console.log('[Serial] Connect result:', result);
            return result;
        } catch (error) {
            console.error('[Serial] Connection error:', error);
            return { success: false, error: (error as Error).message };
        }
    }, []);

    const disconnect = useCallback(async () => {
        try {
            await fetch('http://localhost:3001/api/serial/disconnect', {
                method: 'POST'
            });
        } catch (error) {
            console.error('[Serial] Disconnect error:', error);
        }
    }, []);

    const sendCommand = useCallback((command: string) => {
        const globalWs = getGlobalWs();
        if (globalWs && globalWs.readyState === WebSocket.OPEN) {
            globalWs.send(JSON.stringify({
                command: 'write',
                data: command
            }));
        }
    }, []);

    const clearLog = useCallback(() => {
        setSerialData([]);
        bufferRef.current = '';
    }, []);

    useEffect(() => {
        // Create listener function
        const listener = (message: SerialMessage) => {
            switch (message.type) {
                case 'serial-status':
                    setIsConnected(message.status === 'connected');
                    if (message.device) {
                        setConnectedDevice(message.device);
                    } else if (message.status === 'disconnected') {
                        setConnectedDevice(null);
                    }
                    if (message.status === 'connected') {
                        setSerialData(prev => [...prev, `> Connected to ${message.device?.usbSerial}`]);
                    } else {
                        setSerialData(prev => [...prev, '> Disconnected']);
                    }
                    break;

                case 'serial-data':
                    const timestamp = new Date(message.timestamp || Date.now()).toLocaleTimeString();
                    const newEntry = `${timestamp} -> ${message.data}`;

                    setSerialData(prev => {
                        // Deduplicate: don't add if it's the exact same as the last message
                        if (prev.length > 0 && prev[prev.length - 1] === newEntry) {
                            return prev;
                        }
                        return [...prev, newEntry];
                    });

                    // Try to parse JSON sensor data
                    if (message.data) {
                        parseJsonData(message.data);
                    }
                    break;

                case 'serial-error':
                    setSerialData(prev => [...prev, `ERROR: ${message.error}`]);
                    break;
            }
        };

        // Register listener
        getWsListeners().add(listener);

        // Connect to WebSocket if not already connected
        connectGlobalWebSocket();

        return () => {
            // Unregister listener on unmount
            getWsListeners().delete(listener);
        };
    }, [parseJsonData]);

    return {
        isConnected,
        serialData,
        sensorConfig,
        connectedDevice,
        connectToDevice,
        disconnect,
        sendCommand,
        clearLog
    };
}
