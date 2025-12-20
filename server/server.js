import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { WebSocketServer } from 'ws';
import http from 'http';

const execAsync = promisify(exec);
const app = express();
const PORT = 3001;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Enable CORS for frontend communication
app.use(cors());
app.use(express.json());

// Target USB identifiers for ESP32-S3
const TARGET_VENDOR_ID = 12346;  // 0x303A in decimal
const TARGET_PRODUCT_ID = 4097;  // 0x1001 in decimal

// Serial port state
let connectedPort = null;
let connectedDevice = null;
let isConnecting = false;

/**
 * Parse ioreg output to extract ESP32-S3 devices
 * @param {string} ioregOutput - Raw output from ioreg command
 * @returns {Array} Array of detected device objects
 */
function parseIoregOutput(ioregOutput) {
    const devices = [];
    const lines = ioregOutput.split('\n');

    let currentDevice = null;
    let insideDevice = false;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Look for USB device entries (they have IOUSBHostDevice class)
        if (line.includes('+-o') && line.includes('<class IOUSBHostDevice')) {
            // Start of a new USB device entry
            currentDevice = {};
            insideDevice = true;
            braceDepth = 0;

            // Extract device name from the +-o line
            const match = line.match(/\+-o\s+([^@<]+)/);
            if (match) {
                currentDevice.deviceName = match[1].trim();
            }
        }

        // Track brace depth within device
        if (insideDevice) {
            if (line.includes('{')) {
                braceDepth++;
            }

            // Extract vendor ID
            if (line.includes('"idVendor"')) {
                const match = line.match(/"idVendor"\s*=\s*(\d+)/);
                if (match) {
                    currentDevice.vendorId = parseInt(match[1]);
                }
            }

            // Extract product ID
            if (line.includes('"idProduct"')) {
                const match = line.match(/"idProduct"\s*=\s*(\d+)/);
                if (match) {
                    currentDevice.productId = parseInt(match[1]);
                }
            }

            // Extract USB Serial Number
            if (line.includes('"USB Serial Number"')) {
                const match = line.match(/"USB Serial Number"\s*=\s*"([^"]+)"/);
                if (match) {
                    currentDevice.usbSerial = match[1];
                }
            }

            // Check for closing brace
            if (line.includes('}')) {
                braceDepth--;

                // If we've closed all braces for this device, process it
                if (braceDepth === 0) {
                    // Validate and add device if it matches our criteria
                    if (currentDevice.vendorId === TARGET_VENDOR_ID &&
                        currentDevice.productId === TARGET_PRODUCT_ID &&
                        currentDevice.usbSerial) {
                        devices.push({
                            usbSerial: currentDevice.usbSerial,
                            vendorId: currentDevice.vendorId,
                            productId: currentDevice.productId,
                            deviceName: currentDevice.deviceName || 'Unknown',
                            detectedAt: new Date().toISOString()
                        });

                        console.log(`[Device Detection] Found ESP32-S3: ${currentDevice.usbSerial}`);
                    }

                    currentDevice = null;
                    insideDevice = false;
                }
            }
        }
    }

    return devices;
}

/**
 * Find serial port path for a given USB serial number
 */
async function findSerialPortPath(usbSerial) {
    try {
        const ports = await SerialPort.list();
        console.log('[Serial] Available ports:', ports.map(p => p.path));

        // Try to find by serial number
        const port = ports.find(p => p.serialNumber === usbSerial);
        if (port) {
            return port.path;
        }

        // Fallback: find by manufacturer (Espressif)
        const espPort = ports.find(p =>
            p.manufacturer && p.manufacturer.toLowerCase().includes('espressif')
        );
        if (espPort) {
            console.log('[Serial] Found Espressif port:', espPort.path);
            return espPort.path;
        }

        return null;
    } catch (error) {
        console.error('[Serial] Error listing ports:', error.message);
        return null;
    }
}

/**
 * Execute ioreg and detect ESP32-S3 devices
 * @returns {Promise<Array>} Array of detected devices
 */
async function detectDevices() {
    try {
        console.log('[Device Detection] Querying USB devices via ioreg...');
        const { stdout } = await execAsync('ioreg -p IOUSB -l -w 0');
        const devices = parseIoregOutput(stdout);
        console.log(`[Device Detection] Found ${devices.length} ESP32-S3 device(s)`);
        return devices;
    } catch (error) {
        console.error('[Device Detection] Error executing ioreg:', error.message);
        return [];
    }
}

/**
 * Connect to serial port
 */
async function connectToSerial(device) {
    if (isConnecting) {
        console.log('[Serial] Connection already in progress, skipping...');
        return { success: false, error: 'Connection already in progress' };
    }

    isConnecting = true;
    try {
        // Close existing connection if any
        if (connectedPort && connectedPort.isOpen) {
            console.log('[Serial] Closing existing port...');
            await new Promise((resolve) => {
                connectedPort.close(() => {
                    connectedPort = null;
                    resolve();
                });
            });
        }

        const portPath = await findSerialPortPath(device.usbSerial);
        if (!portPath) {
            isConnecting = false;
            throw new Error(`Could not find serial port for device ${device.usbSerial}`);
        }

        console.log(`[Serial] Connecting to ${portPath}...`);

        const port = new SerialPort({
            path: portPath,
            baudRate: 115200,
            autoOpen: false
        });

        // Return a promise that resolves when connection is established
        return new Promise((resolve, reject) => {
            const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

            port.on('open', () => {
                console.log(`[Serial] Connected to ${portPath}`);
                connectedPort = port;
                connectedDevice = device;
                isConnecting = false;

                // Broadcast connection status to all WebSocket clients
                broadcastToClients({
                    type: 'serial-status',
                    status: 'connected',
                    device: device,
                    port: portPath
                });

                resolve({ success: true, port: portPath, device });
            });

            parser.on('data', (line) => {
                console.log(`[Serial] Data: ${line}`);
                // Broadcast serial data to all WebSocket clients
                broadcastToClients({
                    type: 'serial-data',
                    data: line,
                    timestamp: new Date().toISOString()
                });
            });

            port.on('error', (err) => {
                console.error(`[Serial] Error:`, err.message);
                isConnecting = false;

                // Handle specific error cases
                let errorMessage = err.message;
                if (err.message.includes('Resource busy') || err.message.includes('cannot open')) {
                    errorMessage = `Port ${portPath} is already in use. Please close any other programs (Arduino IDE, screen, etc.) that might be using this port.`;
                }

                broadcastToClients({
                    type: 'serial-error',
                    error: errorMessage
                });

                // Reject on error during connection
                reject(new Error(errorMessage));
            });

            port.on('close', () => {
                console.log('[Serial] Port closed');
                connectedPort = null;
                connectedDevice = null;
                isConnecting = false;
                broadcastToClients({
                    type: 'serial-status',
                    status: 'disconnected'
                });
            });

            // Attempt to open the port
            port.open((err) => {
                if (err) {
                    isConnecting = false;
                    let errorMessage = err.message;
                    if (err.message.includes('Resource busy') || err.message.includes('cannot open')) {
                        errorMessage = `Port ${portPath} is already in use. Please close any other programs (Arduino IDE, screen, etc.) that might be using this port.`;
                    }
                    console.error(`[Serial] Failed to open port:`, errorMessage);
                    reject(new Error(errorMessage));
                }
            });
        });
    } catch (error) {
        isConnecting = false;
        console.error('[Serial] Connection error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Broadcast message to all connected WebSocket clients
 */
function broadcastToClients(message) {
    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(JSON.stringify(message));
        }
    });
}

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('[WebSocket] Client connected');

    // Send current connection status
    if (connectedPort && connectedDevice) {
        ws.send(JSON.stringify({
            type: 'serial-status',
            status: 'connected',
            device: connectedDevice
        }));
    }

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('[WebSocket] Received:', data);

            // Handle commands from client
            if (data.command === 'write' && connectedPort && connectedPort.isOpen) {
                connectedPort.write(data.data + '\n');
            }
        } catch (error) {
            console.error('[WebSocket] Error:', error.message);
        }
    });

    ws.on('close', () => {
        console.log('[WebSocket] Client disconnected');
    });
});

// API endpoint to get detected devices
app.get('/api/devices', async (req, res) => {
    try {
        const devices = await detectDevices();
        res.json({
            success: true,
            count: devices.length,
            devices: devices,
            connectedDevice: connectedDevice
        });
    } catch (error) {
        console.error('[API Error]', error);
        res.status(500).json({
            success: false,
            error: error.message,
            devices: []
        });
    }
});

// API endpoint to connect to a device
app.post('/api/serial/connect', async (req, res) => {
    try {
        const { device } = req.body;
        if (!device || !device.usbSerial) {
            return res.status(400).json({
                success: false,
                error: 'Device information is required'
            });
        }

        const result = await connectToSerial(device);
        res.json(result);
    } catch (error) {
        console.error('[API Error]', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API endpoint to disconnect from serial port
app.post('/api/serial/disconnect', async (req, res) => {
    try {
        if (connectedPort && connectedPort.isOpen) {
            await new Promise((resolve) => {
                connectedPort.close(resolve);
            });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('[API Error]', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

server.listen(PORT, () => {
    console.log(`🚀 Device detection server running on http://localhost:${PORT}`);
    console.log(`📡 Monitoring for ESP32-S3 devices (VID: 0x303A, PID: 0x1001)`);
    console.log(`🔍 Query devices at: http://localhost:${PORT}/api/devices`);
    console.log(`🔌 WebSocket server ready for serial communication`);
});
