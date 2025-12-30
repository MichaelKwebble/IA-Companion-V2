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
let reconnectionAbortController = null;
let lastDataTimestamp = null; // Track when last serial data was received
let connectionEstablishedAt = null; // Track when connection was established

/**
 * Cancel any pending reconnection attempts
 */
function cancelReconnection() {
    if (reconnectionAbortController) {
        console.log('[Serial] Cancelling pending reconnection attempts...');
        reconnectionAbortController.abort();
        reconnectionAbortController = null;
    }
}

// Port Manager to handle exclusive access
class PortManager {
    constructor() {
        this.port = null;
        this.owner = 'IDLE'; // IDLE, SCANNING, MANUAL, FLASHING
        this.portPath = null;
        this.mutex = Promise.resolve();
    }

    /**
     * Acquire the port for a specific purpose
     * @param {string} purpose - 'SCANNING', 'MANUAL', 'FLASHING'
     * @param {string} path - Optional port path
     */
    async acquire(purpose, path = null) {
        // Chain to mutex to serialize access
        const release = await this._lock();
        try {
            console.log(`[PortManager] Request to acquire for ${purpose} (Current: ${this.owner})`);

            // If we already own it for the same purpose, just update path if needed
            if (this.owner === purpose) {
                if (path) this.portPath = path;
                return true;
            }

            // Conflict resolution
            if (this.owner !== 'IDLE') {
                // If flashing, reject everything else
                if (this.owner === 'FLASHING') {
                    console.log(`[PortManager] Rejected ${purpose} because FLASHING`);
                    return false;
                }

                // If manual connection active, reject scanning
                if (this.owner === 'MANUAL' && purpose === 'SCANNING') {
                    return false;
                }

                // If flashing requested, we must preempt others
                if (purpose === 'FLASHING') {
                    console.log(`[PortManager] Preempting ${this.owner} for FLASHING`);
                    await this._forceRelease();
                } else if (purpose === 'MANUAL' && this.owner === 'SCANNING') {
                    // Manual preempts scanning
                    await this._forceRelease();
                } else {
                    console.log(`[PortManager] Rejected ${purpose} because busy with ${this.owner}`);
                    return false;
                }
            }

            this.owner = purpose;
            if (path) this.portPath = path;
            console.log(`[PortManager] Acquired for ${purpose}`);
            return true;
        } finally {
            release();
        }
    }

    /**
     * Release the port
     * @param {string} purpose - The purpose we are releasing
     */
    async release(purpose) {
        const release = await this._lock();
        try {
            if (this.owner === purpose) {
                console.log(`[PortManager] Releasing ${purpose}`);
                await this._closePort();
                this.owner = 'IDLE';
                this.portPath = null;
                this.port = null;
            }
        } finally {
            release();
        }
    }

    /**
     * Set the active serial port object
     */
    setPort(port) {
        this.port = port;
    }

    /**
     * Get current owner
     */
    getOwner() {
        return this.owner;
    }

    // Private: Mutex lock
    _lock() {
        let release;
        const newLock = new Promise(resolve => release = resolve);
        const oldMutex = this.mutex;
        this.mutex = oldMutex.then(() => newLock);
        return oldMutex.then(() => release);
    }

    // Private: Force release current owner
    async _forceRelease() {
        if (this.port && this.port.isOpen) {
            console.log('[PortManager] Force closing port...');
            await this._closePort();
        }
        this.owner = 'IDLE';
        this.port = null;
    }

    // Private: Close port with "Cleanest Close" logic
    async _closePort() {
        if (!this.port || !this.port.isOpen) return;

        const port = this.port;
        this.port = null; // Detach immediately

        try {
            // Remove listeners
            port.unpipe();
            port.removeAllListeners();

            // Clear signals
            console.log('[PortManager] Clearing DTR/RTS...');
            await new Promise(resolve => {
                port.set({ dtr: false, rts: false }, () => resolve());
            });

            // Close immediately
            console.log('[PortManager] Closing port...');
            await new Promise(resolve => {
                port.close(() => resolve());
            });
            console.log('[PortManager] Port closed successfully.');
        } catch (e) {
            console.warn('[PortManager] Error closing port:', e.message);
        }
    }
}

const portManager = new PortManager();

const FLASH_PORT_READY_TIMEOUT_MS = 8000;
const FLASH_PORT_READY_POLL_MS = 250;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function normalizePortPath(portPath) {
    if (!portPath) return portPath;
    if (os.platform() === 'darwin' && portPath.startsWith('/dev/tty.')) {
        return portPath.replace('/dev/tty.', '/dev/cu.');
    }
    return portPath;
}



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
async function findSerialPortPath(usbSerial, options = {}) {
    const { log = true } = options;
    try {
        const ports = await SerialPort.list();
        if (log) {
            console.log('[Serial] Available ports:', ports.map(p => p.path));
        }

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
            if (log) {
                console.log('[Serial] Found Espressif port:', espPort.path);
            }
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
 */
async function detectDevices() {
    // Check if we can scan
    if (portManager.getOwner() === 'FLASHING') {
        console.log('[Device Detection] Skipped due to FLASHING');
        return [];
    }

    // If MANUAL connection is active, we can still scan but shouldn't touch the open port
    // For now, simple logic: if FLASHING, skip.

    try {
        // console.log('[Device Detection] Querying USB devices via ioreg...'); // Reduce log spam
        const { stdout } = await execAsync('ioreg -p IOUSB -l -w 0');
        const devices = parseIoregOutput(stdout);
        // console.log(`[Device Detection] Found ${devices.length} ESP32-S3 device(s)`);
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
    const portPath = await findSerialPortPath(device.usbSerial);
    if (!portPath) {
        return { success: false, error: 'Port not found' };
    }

    // Acquire lock for MANUAL connection
    const acquired = await portManager.acquire('MANUAL', portPath);
    if (!acquired) {
        return { success: false, error: `Port busy (Owner: ${portManager.getOwner()})` };
    }

    isConnecting = true;
    try {
        console.log(`[Serial] Connecting to ${portPath}...`);

        const port = new SerialPort({
            path: portPath,
            baudRate: 115200,
            autoOpen: false
        });

        return new Promise((resolve, reject) => {
            const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

            port.on('open', () => {
                console.log(`[Serial] Connected to ${portPath}`);
                portManager.setPort(port); // Register port with manager
                connectedPort = port;
                connectedDevice = device;
                isConnecting = false;
                connectionEstablishedAt = Date.now();

                broadcastToClients({
                    type: 'serial-status',
                    status: 'connected',
                    device: device,
                    port: portPath
                });

                resolve({ success: true, port: portPath, device });
            });

            parser.on('data', (line) => {
                lastDataTimestamp = Date.now();
                // Strict check: only process data if we are the MANUAL owner
                if (portManager.getOwner() !== 'MANUAL') return;

                // Buffer data
                serialBuffer.push(line);
                if (serialBuffer.length > 2000) serialBuffer = serialBuffer.slice(-1000);
            });

            port.on('error', (err) => {
                console.error(`[Serial] Error:`, err.message);
                isConnecting = false;
                // If error, release lock
                portManager.release('MANUAL');

                let errorMessage = err.message;
                if (err.message.includes('Resource busy')) {
                    errorMessage = `Port ${portPath} is busy.`;
                }
                broadcastToClients({ type: 'serial-error', error: errorMessage });
                reject(new Error(errorMessage));
            });

            port.on('close', () => {
                console.log('[Serial] Port closed');
                if (flushInterval) clearInterval(flushInterval);
                serialBuffer = [];
                connectedPort = null;
                connectedDevice = null;
                isConnecting = false;

                // Only release if we were the owner (might have been preempted)
                if (portManager.getOwner() === 'MANUAL') {
                    portManager.release('MANUAL');
                }

                broadcastToClients({ type: 'serial-status', status: 'disconnected' });
            });

            // Start flush interval
            if (flushInterval) clearInterval(flushInterval);
            flushInterval = setInterval(() => {
                if (portManager.getOwner() !== 'MANUAL') {
                    serialBuffer = [];
                    return;
                }
                if (serialBuffer.length > 0) {
                    broadcastToClients({
                        type: 'serial-data',
                        data: serialBuffer,
                        timestamp: new Date().toISOString()
                    });
                    serialBuffer = [];
                }
            }, 16);

            port.open((err) => {
                if (err) {
                    portManager.release('MANUAL');
                    isConnecting = false;
                    reject(err);
                }
            });
        });
    } catch (error) {
        portManager.release('MANUAL');
        isConnecting = false;
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

// API endpoint to disconnect
app.post('/api/serial/disconnect', async (req, res) => {
    try {
        await portManager.release('MANUAL');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API endpoint to flash code
app.post('/api/flash', async (req, res) => {
    const { code, usbSerial, projectRoot, currentFilePath } = req.body;
    if (!code || !usbSerial) return res.status(400).json({ success: false, error: 'Missing args' });

    // 1. Acquire FLASHING lock (this will preempt MANUAL connection)
    const acquired = await portManager.acquire('FLASHING');
    if (!acquired) {
        return res.status(409).json({ success: false, error: 'Could not acquire port for flashing' });
    }

    const deviceToReconnect = connectedDevice;
    cancelReconnection();
    let tempDir = null;

    try {
        const portPath = await findSerialPortPath(usbSerial);
        if (!portPath) throw new Error('Port not found');

        console.log(`[Flash] Starting flash on ${portPath}`);

        // Broadcast start
        broadcastToClients({
            type: 'flash-status',
            status: 'compiling',
            message: 'Starting flash process...'
        });

        // 2. Prepare temp dir and files
        const parentTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ia-companion-'));
        let sketchName = 'sketch';
        if (currentFilePath) sketchName = path.basename(currentFilePath, path.extname(currentFilePath));
        tempDir = path.join(parentTempDir, sketchName);
        await fs.mkdir(tempDir, { recursive: true });

        if (projectRoot) {
            const entries = await fs.readdir(projectRoot, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (['.ino', '.h', '.cpp', '.c', '.hpp'].includes(ext)) {
                        await fs.copyFile(path.join(projectRoot, entry.name), path.join(tempDir, entry.name));
                    }
                }
            }
        }
        await fs.writeFile(path.join(tempDir, `${sketchName}.ino`), code);

        // 3. Compile
        const fqbn = 'esp32:esp32:esp32s3:CDCOnBoot=cdc,USBMode=hwcdc,UploadMode=default,UploadSpeed=115200';
        const compileCmd = `arduino-cli compile --fqbn ${fqbn} "${tempDir}"`;

        broadcastToClients({ type: 'flash-status', status: 'compiling', message: 'Compiling...' });
        await execAsync(compileCmd, { timeout: 120000 });

        // 4. Upload with Retries
        const uploadCmd = `arduino-cli upload -p ${normalizePortPath(portPath)} --fqbn ${fqbn} "${tempDir}"`;

        let uploadSuccess = false;
        let lastError = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log(`[Flash] Upload attempt ${attempt}...`);
                broadcastToClients({
                    type: 'flash-status',
                    status: 'uploading',
                    message: attempt === 1 ? 'Uploading...' : `Retrying upload (Attempt ${attempt})...`
                });

                if (attempt > 1) await sleep(1000); // Small gap between retries

                await execAsync(uploadCmd);
                uploadSuccess = true;
                break;
            } catch (error) {
                lastError = error;
                const stderr = error.stderr || '';
                const message = error.message || '';

                const isRetryable = stderr.includes('Invalid head of packet') ||
                    message.includes('Invalid head of packet') ||
                    stderr.includes('Failed to connect to ESP32-S3') ||
                    message.includes('Failed to connect to ESP32-S3');

                if (isRetryable && attempt < 3) {
                    console.warn(`[Flash] Attempt ${attempt} failed with retryable error. Retrying...`);
                    continue;
                } else {
                    throw error; // Not retryable or last attempt
                }
            }
        }

        broadcastToClients({ type: 'flash-status', status: 'success', message: 'Flash successful!' });
        res.json({ success: true, message: 'Flash successful' });

    } catch (error) {
        console.error('[Flash] Error:', error.message);
        broadcastToClients({ type: 'flash-status', status: 'error', message: error.message });
        res.status(500).json({ success: false, error: error.message });
    } finally {
        // Release lock
        await portManager.release('FLASHING');

        if (tempDir) {
            try { await fs.rm(tempDir, { recursive: true, force: true }); } catch (e) { }
        }

        // Reconnect if we had a device
        if (deviceToReconnect) {
            console.log('[Flash] Attempting to reconnect to serial monitor...');
            setTimeout(async () => {
                try {
                    await connectToSerial(deviceToReconnect);
                } catch (e) {
                    console.warn('[Flash] Auto-reconnect failed:', e.message);
                }
            }, 2000); // Give device time to boot
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
