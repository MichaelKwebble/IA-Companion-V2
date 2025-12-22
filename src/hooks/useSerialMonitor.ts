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
            // Accumulate data
            bufferRef.current += data;

            // Clean the buffer: remove timestamps like "12:27:29.205 -> "
            const cleanBuffer = bufferRef.current.replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s*->\s*/g, '');

            // Try to find a complete JSON object or array
            const firstBrace = cleanBuffer.indexOf('{');
            const firstBracket = cleanBuffer.indexOf('[');

            // Handle new format: {"status":[...], "sensor_names":[...]}
            if (firstBrace !== -1 && cleanBuffer.includes('}', firstBrace)) {
                const lastBrace = cleanBuffer.lastIndexOf('}');
                const jsonStr = cleanBuffer.substring(firstBrace, lastBrace + 1);

                try {
                    const parsed = JSON.parse(jsonStr);
                    if (parsed.status && parsed.sensor_names) {
                        const SENSOR_MAPPING: Record<string, number> = {
                            'light': 1,
                            'aq': 2,
                            'ultrasonic': 5,
                            'ir': 9,
                            'not_detected': -2
                        };

                        const newConfig: SensorPort[] = parsed.sensor_names.map((name: string, index: number) => ({
                            port: index,
                            sensor: SENSOR_MAPPING[name] || -2,
                            value: 0 // Status messages might not have values
                        }));

                        console.log('[Serial Parser] Parsed status update:', newConfig);
                        setSensorConfig(newConfig);
                        // Clear the part of the buffer we just processed
                        // We use the original buffer to find where to cut
                        const processedPart = bufferRef.current.substring(0, bufferRef.current.lastIndexOf('}') + 1);
                        bufferRef.current = bufferRef.current.substring(processedPart.length);
                        return;
                    }
                } catch (e) {
                    // Not a valid full JSON yet or different format
                }
            }

            // Handle legacy/fragmented format: [ "port":0,"sensor":1,"value":1.00}, ... ]
            if (firstBracket !== -1 && cleanBuffer.includes(']', firstBracket)) {
                const lastBracket = cleanBuffer.lastIndexOf(']') + 1;
                const rawContent = cleanBuffer.substring(firstBracket, lastBracket);

                // 1. Remove the outer brackets
                let content = rawContent.slice(1, -1).trim();

                // 2. Split by the }, delimiter
                let parts = content.split(/\}\s*,?\s*/);

                let parsedObjects: SensorPort[] = [];

                parts.forEach(part => {
                    let cleanPart = part.trim();
                    if (!cleanPart) return;

                    if (!cleanPart.startsWith('{')) cleanPart = '{' + cleanPart;
                    if (!cleanPart.endsWith('}')) cleanPart = cleanPart + '}';

                    try {
                        const obj = JSON.parse(cleanPart);
                        if (typeof obj.port === 'number' && typeof obj.sensor === 'number') {
                            parsedObjects.push(obj as SensorPort);
                        }
                    } catch (e) { }
                });

                if (parsedObjects.length > 0) {
                    setSensorConfig(parsedObjects);
                    const processedPart = bufferRef.current.substring(0, bufferRef.current.lastIndexOf(']') + 1);
                    bufferRef.current = bufferRef.current.substring(processedPart.length);
                }
            }

            // Prevent buffer bloat
            if (bufferRef.current.length > 4000) {
                bufferRef.current = '';
            }
        } catch (error) {
            console.error('[Serial Parser] Error:', error);
            if (bufferRef.current.length > 4000) bufferRef.current = '';
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
