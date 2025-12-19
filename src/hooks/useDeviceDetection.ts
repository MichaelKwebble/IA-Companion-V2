import { useState, useEffect, useCallback } from 'react';
import type { ESP32Device, DeviceResponse } from '../types/device';

const API_BASE_URL = 'http://localhost:3001';
const POLL_INTERVAL = 2000; // 2 seconds

export function useDeviceDetection() {
    const [devices, setDevices] = useState<ESP32Device[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    const fetchDevices = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/devices`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: DeviceResponse = await response.json();

            if (data.success) {
                console.log(`[Device Detection] Received ${data.count} device(s):`, data.devices);
                setDevices(data.devices);
                setError(null);
                setLastUpdate(new Date());
            } else {
                console.error('[Device Detection] API returned error:', data.error);
                setError(data.error || 'Unknown error');
            }

            setIsLoading(false);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch devices';
            console.error('[Device Detection] Fetch error:', errorMessage);
            setError(errorMessage);
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        // Initial fetch
        console.log('[Device Detection] Starting device detection polling...');
        fetchDevices();

        // Set up polling interval
        const intervalId = setInterval(() => {
            console.log('[Device Detection] Polling for devices...');
            fetchDevices();
        }, POLL_INTERVAL);

        // Cleanup on unmount
        return () => {
            console.log('[Device Detection] Stopping device detection polling');
            clearInterval(intervalId);
        };
    }, [fetchDevices]);

    return {
        devices,
        isLoading,
        error,
        lastUpdate,
        refresh: fetchDevices
    };
}
