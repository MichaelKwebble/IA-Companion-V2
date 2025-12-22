import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);
const app = express();
const PORT = 3001;
let currentProjectRoot = path.join(__dirname, '..');

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Enable CORS for frontend communication
app.use(cors());
app.use(express.json());

// Logging middleware for debugging
app.use((req, res, next) => {
    console.log(`[Server] ${req.method} ${req.url}`);
    next();
});

// Target USB identifiers for ESP32-S3
const TARGET_VENDOR_ID = 12346;  // 0x303A in decimal
const TARGET_PRODUCT_ID = 4097;  // 0x1001 in decimal

// Serial port state
let connectedPort = null;
let connectedDevice = null;
let isConnecting = false;
let isFlashing = false;
let serialBuffer = [];
let flushInterval = null;

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
                            deviceName: 'IA Kit Pro (temporary)',
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
    if (isConnecting || isFlashing) {
        console.log(`[Serial] Connection skipped: isConnecting=${isConnecting}, isFlashing=${isFlashing}`);
        return { success: false, error: 'Connection or flash in progress' };
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
                // strict check: do not send data if we are flashing
                if (isFlashing) {
                    console.log('[Serial] Skipping data due to flashing');
                    return;
                }

                // Buffer data instead of sending immediately
                console.log('[Serial] Data received:', line.substring(0, 50)); // Debug log
                serialBuffer.push(line);

                // Cap buffer size to prevent memory issues with extreme spam
                if (serialBuffer.length > 2000) {
                    serialBuffer = serialBuffer.slice(-1000); // Keep last 1000 lines
                }
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
                if (flushInterval) clearInterval(flushInterval);
                serialBuffer = [];
                connectedPort = null;
                connectedDevice = null;
                isConnecting = false;
                broadcastToClients({
                    type: 'serial-status',
                    status: 'disconnected'
                });
            });

            // Start flush interval
            if (flushInterval) clearInterval(flushInterval);
            flushInterval = setInterval(() => {
                if (serialBuffer.length > 0) {
                    console.log(`[Serial] Flushing ${serialBuffer.length} lines`);
                    broadcastToClients({
                        type: 'serial-data',
                        data: serialBuffer,
                        timestamp: new Date().toISOString()
                    });
                    serialBuffer = [];
                }
            }, 100); // Flush every 100ms (throttled)

            port.open((err) => {
                if (err) {
                    if (flushInterval) clearInterval(flushInterval);
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

// API endpoint to flash code to a device
app.post('/api/flash', async (req, res) => {
    const { code, usbSerial, projectRoot, currentFilePath } = req.body;
    if (!code || !usbSerial) {
        return res.status(400).json({ success: false, error: 'Code and usbSerial are required' });
    }

    // 0. Immediate flag set to stop data flow
    isFlashing = true;

    let tempDir = null;
    let wasConnected = false;
    let deviceToReconnect = null;

    try {
        // 1. Find the port
        const portPath = await findSerialPortPath(usbSerial);
        if (!portPath) {
            throw new Error(`Could not find serial port for device ${usbSerial}`);
        }

        // 2. Pause serial connection if it's currently active
        if (connectedPort && connectedPort.isOpen && connectedPort.path === portPath) {
            console.log(`[Flash] Aggressively pausing serial connection on ${portPath}...`);
            wasConnected = true;
            deviceToReconnect = connectedDevice;

            // Immediately stop data flow to prevent lag
            try {
                connectedPort.unpipe();
                connectedPort.removeAllListeners('data');
                connectedPort.removeAllListeners('error');

                // Drain any pending data
                console.log('[Flash] Draining port...');
                await new Promise((resolve) => connectedPort.drain(resolve));

                // Toggle DTR/RTS to force reset
                console.log('[Flash] Toggling DTR/RTS for hard reset...');
                await new Promise(resolve => connectedPort.set({ dtr: false, rts: true }, resolve));
                await new Promise(resolve => setTimeout(resolve, 100));
                await new Promise(resolve => connectedPort.set({ dtr: true, rts: false }, resolve));

                // Flush any remaining data
                await new Promise((resolve) => connectedPort.flush(resolve));
            } catch (e) {
                console.warn('[Flash] Error clearing listeners/resetting:', e.message);
            }

            await new Promise((resolve) => {
                connectedPort.close(() => {
                    resolve();
                });
            });
            connectedPort = null; // Explicitly nullify immediately

            broadcastToClients({ type: 'serial-status', status: 'disconnected' });
            // Longer delay to ensure OS releases the port and device resets
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        // 2.5 Force 1200bps touch for ESP32-S3 USB CDC bootloader entry
        console.log(`[Flash] Waiting for port to settle...`);
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log(`[Flash] Triggering 1200bps touch on ${portPath}...`);
        try {
            const touchPort = new SerialPort({ path: portPath, baudRate: 1200, autoOpen: false });
            await new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    console.warn('[Flash] 1200bps touch timed out');
                    resolve();
                }, 5000); // Increased timeout for busy systems

                touchPort.open(async (err) => {
                    if (!err) {
                        console.log('[Flash] 1200bps touch port opened, holding for 100ms...');
                        // Hold the 1200bps connection briefly to ensure OS registers it
                        await new Promise(r => setTimeout(r, 100));

                        touchPort.close(() => {
                            clearTimeout(timeout);
                            resolve();
                        });
                    } else {
                        console.warn(`[Flash] 1200bps touch open failed: ${err.message}`);
                        clearTimeout(timeout);
                        resolve();
                    }
                });
            });
            // Wait longer for device to re-enumerate in bootloader mode
            console.log('[Flash] Waiting for device to enter bootloader...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (touchErr) {
            console.warn(`[Flash] 1200bps touch error: ${touchErr.message}`);
        }

        isFlashing = true;

        // 3. Create temporary sketch
        const parentTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ia-companion-'));

        // Determine sketch name from currentFilePath or default to 'sketch'
        let sketchName = 'sketch';
        if (currentFilePath) {
            sketchName = path.basename(currentFilePath, path.extname(currentFilePath));
        }

        tempDir = path.join(parentTempDir, sketchName);
        await fs.mkdir(tempDir, { recursive: true });

        if (projectRoot) {
            console.log(`[Flash] Copying project files from ${projectRoot} to ${tempDir}`);
            // Copy all files from projectRoot to tempDir
            const entries = await fs.readdir(projectRoot, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    // Only copy source files
                    if (['.ino', '.h', '.cpp', '.c', '.hpp'].includes(ext)) {
                        await fs.copyFile(path.join(projectRoot, entry.name), path.join(tempDir, entry.name));
                    }
                }
            }
        }

        // Ensure the main .ino file exists and has the latest code
        const mainInoPath = path.join(tempDir, `${sketchName}.ino`);
        await fs.writeFile(mainInoPath, code);

        console.log(`[Flash] Compiling and flashing to ${portPath}...`);
        broadcastToClients({ type: 'flash-status', status: 'compiling', message: 'Compiling code...' });

        // 4. Compile
        const fqbn = 'esp32:esp32:esp32s3:CDCOnBoot=cdc,USBMode=hwcdc,UploadMode=default';
        console.log(`[Flash] Using FQBN: ${fqbn}`);
        try {
            console.log(`[Flash] Compiling sketch in: ${tempDir}`);
            const { stdout: compileOut, stderr: compileErr } = await execAsync(`arduino-cli compile --fqbn ${fqbn} "${tempDir}"`);
            console.log('[Flash] Compile output:', compileOut);
            if (compileErr) console.warn('[Flash] Compile warnings:', compileErr);
        } catch (err) {
            throw new Error(`Compilation failed: ${err.message}`);
        }

        broadcastToClients({ type: 'flash-status', status: 'uploading', message: 'Uploading to device...' });

        // 5. Upload
        try {
            console.log(`[Flash] Uploading to port: ${portPath}`);
            const { stdout: uploadOut, stderr: uploadErr } = await execAsync(`arduino-cli upload -p ${portPath} --fqbn ${fqbn} "${tempDir}"`);
            console.log('[Flash] Upload output:', uploadOut);
            if (uploadErr) console.warn('[Flash] Upload warnings:', uploadErr);
        } catch (err) {
            throw new Error(`Upload failed: ${err.message}`);
        }

        broadcastToClients({ type: 'flash-status', status: 'success', message: 'Flash successful!' });

        // 6. Reconnect if it was connected before
        if (wasConnected && deviceToReconnect) {
            console.log(`[Flash] Reconnecting to ${portPath} (with retries)...`);

            const maxRetries = 5;
            let retryCount = 0;

            const attemptReconnect = async () => {
                try {
                    console.log(`[Flash] Reconnection attempt ${retryCount + 1}/${maxRetries}...`);
                    const result = await connectToSerial(deviceToReconnect);
                    if (result.success) {
                        console.log('[Flash] Reconnected successfully!');
                        return true;
                    }
                } catch (err) {
                    console.warn(`[Flash] Reconnection attempt ${retryCount + 1} failed: ${err.message}`);
                }
                return false;
            };

            const runRetryLoop = async () => {
                while (retryCount < maxRetries) {
                    // Wait a bit for the device to reset and OS to re-enumerate
                    await new Promise(resolve => setTimeout(resolve, 1500 + (retryCount * 500)));

                    const success = await attemptReconnect();
                    if (success) break;

                    retryCount++;
                }

                if (retryCount >= maxRetries) {
                    console.error('[Flash] Failed to auto-reconnect after all attempts.');
                    broadcastToClients({
                        type: 'serial-error',
                        error: 'Failed to auto-reconnect serial monitor. Please try connecting manually.'
                    });
                }
            };

            runRetryLoop();
        }

        res.json({ success: true, message: 'Flash successful' });

    } catch (error) {
        console.error('[Flash] Error:', error.message);
        broadcastToClients({ type: 'flash-status', status: 'error', message: error.message });
        res.status(500).json({ success: false, error: error.message });
    } finally {
        isFlashing = false;
        // Cleanup temp files
        if (tempDir) {
            try {
                // Clean up the parent temp dir
                await fs.rm(path.dirname(tempDir), { recursive: true, force: true });
            } catch (err) {
                console.error('[Flash] Cleanup error:', err.message);
            }
        }
    }
});

// API endpoint to list files
app.get('/api/files', async (req, res) => {
    const projectRoot = currentProjectRoot;

    async function getFiles(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(entries.map(async (entry) => {
            const resPath = path.resolve(dir, entry.name);
            const relPath = path.relative(projectRoot, resPath);

            // Skip node_modules and .git
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
                return null;
            }

            if (entry.isDirectory()) {
                const children = await getFiles(resPath);
                return {
                    id: relPath,
                    name: entry.name,
                    type: 'folder',
                    children: children.filter(c => c !== null)
                };
            } else {
                return {
                    id: relPath,
                    name: entry.name,
                    type: 'file'
                };
            }
        }));
        return files.filter(f => f !== null);
    }

    try {
        const fileTree = await getFiles(projectRoot);
        res.json({ success: true, files: fileTree });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API endpoint to read a file
app.get('/api/files/read', async (req, res) => {
    const { filePath } = req.query;
    if (!filePath) return res.status(400).json({ success: false, error: 'filePath is required' });

    try {
        const fullPath = path.join(currentProjectRoot, filePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        res.json({ success: true, content });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API endpoint to write a file
app.post('/api/files/write', async (req, res) => {
    const { filePath, content } = req.body;
    if (!filePath || content === undefined) {
        return res.status(400).json({ success: false, error: 'filePath and content are required' });
    }

    try {
        const fullPath = path.join(currentProjectRoot, filePath);
        await fs.writeFile(fullPath, content, 'utf-8');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API endpoint to create a new file
app.post('/api/files/create', async (req, res) => {
    const { filePath, content } = req.body;
    if (!filePath) return res.status(400).json({ success: false, error: 'filePath is required' });

    try {
        const fullPath = path.join(currentProjectRoot, filePath);

        // Check if file already exists
        try {
            await fs.access(fullPath);
            return res.status(400).json({ success: false, error: 'File already exists' });
        } catch (e) {
            // File does not exist, proceed
        }

        // Ensure directory exists
        await fs.mkdir(path.dirname(fullPath), { recursive: true });

        await fs.writeFile(fullPath, content || '', 'utf-8');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API endpoint to set project root
app.post('/api/config/project-root', async (req, res) => {
    const { rootPath } = req.body;
    if (!rootPath) return res.status(400).json({ success: false, error: 'rootPath is required' });

    try {
        // Verify path exists
        await fs.access(rootPath);
        currentProjectRoot = rootPath;
        console.log(`[Config] Project root updated to: ${currentProjectRoot}`);
        res.json({ success: true, root: currentProjectRoot });
    } catch (error) {
        res.status(400).json({ success: false, error: `Invalid path: ${error.message}` });
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
