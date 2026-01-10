import express from 'express';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import multer from 'multer';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);
const app = express();
const PORT = 3001;
const APP_ROOT = path.join(__dirname, '..');
const PROJECTS_FILE = path.join(APP_ROOT, 'projects.json');
const ARDUINO_ROOT = path.join(APP_ROOT, 'arduino');
const ARDUINO_CONFIG_DIR = path.join(ARDUINO_ROOT, 'config');
const ARDUINO_DATA_DIR = path.join(ARDUINO_ROOT, 'data');
const ARDUINO_DOWNLOADS_DIR = path.join(ARDUINO_ROOT, 'downloads');
const ARDUINO_USER_DIR = path.join(ARDUINO_ROOT, 'user');
const ARDUINO_LIBS_DIR = path.join(ARDUINO_USER_DIR, 'libraries');
const ARDUINO_SKETCHES_DIR = path.join(ARDUINO_USER_DIR, 'sketches');
const ARDUINO_YAML_PATH = path.join(ARDUINO_CONFIG_DIR, 'arduino-cli.yaml');

// Multer setup for ZIP uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, ARDUINO_DOWNLOADS_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// Ensure Arduino directories exist
async function initArduinoDirs() {
    const dirs = [
        ARDUINO_ROOT,
        ARDUINO_CONFIG_DIR,
        ARDUINO_DATA_DIR,
        ARDUINO_DOWNLOADS_DIR,
        ARDUINO_USER_DIR,
        ARDUINO_LIBS_DIR,
        ARDUINO_SKETCHES_DIR
    ];

    for (const dir of dirs) {
        await fs.mkdir(dir, { recursive: true });
    }

    // Generate arduino-cli.yaml if it doesn't exist
    try {
        await fs.access(ARDUINO_YAML_PATH);
    } catch (e) {
        const yamlContent = `
directories:
  data: "${ARDUINO_DATA_DIR}"
  downloads: "${ARDUINO_DOWNLOADS_DIR}"
  user: "${ARDUINO_USER_DIR}"

board_manager:
  additional_urls: [
    "https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json"
  ]
`;
        await fs.writeFile(ARDUINO_YAML_PATH, yamlContent.trim(), 'utf-8');
        console.log(`[Arduino] Created config at ${ARDUINO_YAML_PATH}`);
    }
}

// Helper to run arduino-cli with config
async function runArduinoCLI(args, options = {}) {
    const defaultArgs = ['--config-file', ARDUINO_YAML_PATH];
    const allArgs = [...defaultArgs, ...args];

    console.log(`[Arduino CLI] Running: arduino-cli ${allArgs.join(' ')}`);

    if (options.spawn) {
        return spawn('arduino-cli', allArgs, options);
    }

    // Increase maxBuffer to 100MB for large search results (e.g. lib search)
    return execAsync(`arduino-cli ${allArgs.map(a => `"${a}"`).join(' ')}`, {
        ...options,
        maxBuffer: 100 * 1024 * 1024
    });
}

// Initialize on startup
initArduinoDirs().catch(err => console.error('[Arduino] Init failed:', err));


// Helper to load projects
async function loadProjects() {
    try {
        const data = await fs.readFile(PROJECTS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        // Default projects if file doesn't exist
        return [
            { id: '1', name: 'Blink LED', type: 'code', path: '/Users/michaelcheng/Desktop/Test/Blink_LED', lastModified: '2 mins ago' },
            { id: '2', name: 'Smart Home UI', type: 'design', lastModified: '1 hour ago' },
        ];
    }
}

// Helper to save projects
async function saveProjects(projects) {
    await fs.writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf-8');
}

// Helper to delete project directory
async function deleteProjectDirectory(projectPath) {
    try {
        await fs.rm(projectPath, { recursive: true, force: true });
        console.log(`[Server] Deleted directory: ${projectPath}`);
        return true;
    } catch (error) {
        console.error(`[Server] Failed to delete directory ${projectPath}:`, error);
        return false;
    }
}

let currentProjectRoot = APP_ROOT;

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
            } else if (data.command === 'terminal') {
                handleTerminalCommand(data.data);
            }
        } catch (error) {
            console.error('[WebSocket] Error:', error.message);
        }
    });

    ws.on('close', () => {
        console.log('[WebSocket] Client disconnected');
    });
});

/**
 * Handle terminal commands from the IDE
 */
async function handleTerminalCommand(command) {
    const timestamp = new Date().toLocaleTimeString();
    broadcastToClients({
        type: 'terminal-log',
        data: `user@ia-companion:~$ ${command}`,
        timestamp
    });

    try {
        // For now, only allow safe commands or specific IDE commands
        // In a real app, you'd want a restricted shell or specific handlers
        if (command === 'clear') {
            broadcastToClients({ type: 'terminal-clear' });
            return;
        }

        const { stdout, stderr } = await execAsync(command, { cwd: currentProjectRoot, timeout: 30000 });

        if (stdout) {
            broadcastToClients({
                type: 'terminal-log',
                data: stdout,
                timestamp: new Date().toLocaleTimeString()
            });
        }
        if (stderr) {
            broadcastToClients({
                type: 'terminal-log',
                data: `stderr: ${stderr}`,
                timestamp: new Date().toLocaleTimeString(),
                isError: true
            });
        }
    } catch (error) {
        broadcastToClients({
            type: 'terminal-log',
            data: `Error: ${error.message}`,
            timestamp: new Date().toLocaleTimeString(),
            isError: true
        });
    }
}

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


// API endpoint to delete a project
app.delete('/api/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const projects = await loadProjects();
        const projectIndex = projects.findIndex(p => p.id === id);

        if (projectIndex === -1) {
            return res.status(404).json({ success: false, error: 'Project not found' });
        }

        const project = projects[projectIndex];

        // Remove from list
        projects.splice(projectIndex, 1);
        await saveProjects(projects);

        // Delete from disk if it has a path
        if (project.path) {
            await deleteProjectDirectory(project.path);
        }

        res.json({ success: true, message: 'Project deleted successfully' });
    } catch (error) {
        console.error('[API Error]', error);
        res.status(500).json({ success: false, error: error.message });
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

// --- Arduino Boards Manager Endpoints ---

app.post('/api/arduino/boards/update-index', async (req, res) => {
    try {
        await runArduinoCLI(['core', 'update-index']);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/arduino/boards/list', async (req, res) => {
    try {
        const { stdout } = await runArduinoCLI(['core', 'list', '--format', 'json']);
        res.json({ success: true, data: JSON.parse(stdout) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/arduino/boards/search', async (req, res) => {
    try {
        const { query } = req.query;
        const args = ['core', 'search'];
        if (query) args.push(query);
        args.push('--format', 'json');
        const { stdout } = await runArduinoCLI(args);
        res.json({ success: true, data: JSON.parse(stdout) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/arduino/boards/install', async (req, res) => {
    const { fqbn } = req.body;
    if (!fqbn) return res.status(400).json({ success: false, error: 'FQBN is required' });

    try {
        // Use spawn to stream output to clients
        const child = await runArduinoCLI(['core', 'install', fqbn], { spawn: true });

        child.stdout.on('data', (data) => {
            broadcastToClients({ type: 'arduino-log', data: data.toString() });
        });

        child.stderr.on('data', (data) => {
            broadcastToClients({ type: 'arduino-log', data: data.toString(), isError: true });
        });

        child.on('close', (code) => {
            if (code === 0) {
                broadcastToClients({ type: 'arduino-status', status: 'success', id: fqbn, message: `Installed ${fqbn}` });
            } else {
                broadcastToClients({ type: 'arduino-status', status: 'error', id: fqbn, message: `Failed to install ${fqbn}` });
            }
        });

        res.json({ success: true, message: 'Installation started' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/arduino/boards/uninstall', async (req, res) => {
    const { fqbn } = req.body;
    try {
        broadcastToClients({ type: 'arduino-status', status: 'starting', id: fqbn, message: `Uninstalling ${fqbn}...` });
        await runArduinoCLI(['core', 'uninstall', fqbn]);
        broadcastToClients({ type: 'arduino-status', status: 'success', id: fqbn, message: `Uninstalled ${fqbn}` });
        res.json({ success: true });
    } catch (error) {
        broadcastToClients({ type: 'arduino-status', status: 'error', id: fqbn, message: `Failed to uninstall ${fqbn}: ${error.message}` });
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/arduino/boards/config/urls', async (req, res) => {
    const { urls } = req.body; // Array of strings
    try {
        const urlsStr = urls.join(',');
        await runArduinoCLI(['config', 'set', 'board_manager.additional_urls', urlsStr]);
        await runArduinoCLI(['core', 'update-index']);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Arduino Library Manager Endpoints ---

app.post('/api/arduino/libraries/update-index', async (req, res) => {
    try {
        await runArduinoCLI(['lib', 'update-index']);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/arduino/libraries/list', async (req, res) => {
    try {
        const { updatable } = req.query;
        const args = ['lib', 'list', '--format', 'json'];
        if (updatable === 'true') args.push('--updatable');
        const { stdout } = await runArduinoCLI(args);
        res.json({ success: true, data: JSON.parse(stdout) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/arduino/libraries/search', async (req, res) => {
    try {
        const { query } = req.query;
        const args = ['lib', 'search'];
        if (query) args.push(query);
        args.push('--format', 'json');

        const { stdout } = await runArduinoCLI(args);
        let data = JSON.parse(stdout);

        // If no query, limit to first 100 results for performance
        if (!query && data.libraries && data.libraries.length > 100) {
            data.libraries = data.libraries.slice(0, 100);
            data.limited = true;
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error(`[Arduino] Library search failed: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/arduino/libraries/install', async (req, res) => {
    const { name, version } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Library name is required' });

    try {
        const libSpec = version ? `${name}@${version}` : name;
        const child = await runArduinoCLI(['lib', 'install', libSpec], { spawn: true });

        child.stdout.on('data', (data) => {
            broadcastToClients({ type: 'arduino-log', data: data.toString() });
        });

        child.stderr.on('data', (data) => {
            broadcastToClients({ type: 'arduino-log', data: data.toString(), isError: true });
        });

        child.on('close', (code) => {
            if (code === 0) {
                broadcastToClients({ type: 'arduino-status', status: 'success', id: name, message: `Installed ${name}` });
            } else {
                broadcastToClients({ type: 'arduino-status', status: 'error', id: name, message: `Failed to install ${name}` });
            }
        });

        res.json({ success: true, message: 'Installation started' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/arduino/libraries/uninstall', async (req, res) => {
    const { name } = req.body;
    try {
        broadcastToClients({ type: 'arduino-status', status: 'starting', id: name, message: `Uninstalling ${name}...` });
        await runArduinoCLI(['lib', 'uninstall', name]);

        // Automatically clean up cached ZIP for this library
        try {
            const libCacheDir = path.join(ARDUINO_DOWNLOADS_DIR, 'libraries');
            const files = await fs.readdir(libCacheDir);
            for (const file of files) {
                if (file.startsWith(`${name}-`) && file.endsWith('.zip')) {
                    await fs.unlink(path.join(libCacheDir, file));
                    console.log(`[Arduino] Automatically removed cached ZIP: ${file}`);
                }
            }
        } catch (cacheErr) {
            console.warn(`[Arduino] Failed to clean up cache for ${name}: ${cacheErr.message}`);
        }

        broadcastToClients({ type: 'arduino-status', status: 'success', id: name, message: `Uninstalled ${name}` });
        res.json({ success: true });
    } catch (error) {
        broadcastToClients({ type: 'arduino-status', status: 'error', id: name, message: `Failed to uninstall ${name}: ${error.message}` });
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/arduino/libraries/upgrade-all', async (req, res) => {
    try {
        const child = await runArduinoCLI(['lib', 'upgrade', '--all'], { spawn: true });

        child.stdout.on('data', (data) => {
            broadcastToClients({ type: 'arduino-log', data: data.toString() });
        });

        child.on('close', (code) => {
            if (code === 0) {
                broadcastToClients({ type: 'arduino-status', status: 'success', message: 'All libraries upgraded' });
            } else {
                broadcastToClients({ type: 'arduino-status', status: 'error', message: 'Failed to upgrade libraries' });
            }
        });

        res.json({ success: true, message: 'Upgrade started' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/arduino/libraries/examples', async (req, res) => {
    try {
        const libs = await fs.readdir(ARDUINO_LIBS_DIR, { withFileTypes: true });
        const result = [];

        for (const lib of libs) {
            if (lib.isDirectory()) {
                const examplesPath = path.join(ARDUINO_LIBS_DIR, lib.name, 'examples');
                try {
                    const examples = await fs.readdir(examplesPath, { withFileTypes: true });
                    const exampleFolders = examples
                        .filter(e => e.isDirectory())
                        .map(e => e.name);

                    if (exampleFolders.length > 0) {
                        result.push({
                            library: lib.name,
                            examples: exampleFolders
                        });
                    }
                } catch (e) {
                    // No examples folder or not readable
                }
            }
        }
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/arduino/libraries/examples/open', async (req, res) => {
    const { library, example, mode } = req.body; // mode: 'preview' | 'clone'
    if (!library || !example) return res.status(400).json({ success: false, error: 'Library and example names are required' });

    const sourcePath = path.join(ARDUINO_LIBS_DIR, library, 'examples', example);

    try {
        await fs.access(sourcePath);

        if (mode === 'preview') {
            // Find the .ino file (usually matches folder name)
            const files = await fs.readdir(sourcePath);
            const mainFile = files.find(f => f.endsWith('.ino')) || `${example}.ino`;

            res.json({
                success: true,
                project: {
                    id: `preview-${library}-${example}`,
                    name: `${library}: ${example}`,
                    path: sourcePath,
                    type: 'code',
                    mainFile,
                    readOnly: true
                }
            });
        } else {
            // Clone mode
            const projects = await loadProjects();
            let projectName = `${library}_${example}`;
            let destPath = path.join(ARDUINO_SKETCHES_DIR, projectName);

            // Handle collisions
            let counter = 1;
            while (true) {
                try {
                    await fs.access(destPath);
                    projectName = `${library}_${example}_${counter}`;
                    destPath = path.join(ARDUINO_SKETCHES_DIR, projectName);
                    counter++;
                } catch (e) {
                    break;
                }
            }

            // Copy folder
            await fs.mkdir(destPath, { recursive: true });
            const copyDir = async (src, dest) => {
                const entries = await fs.readdir(src, { withFileTypes: true });
                for (const entry of entries) {
                    const srcPath = path.join(src, entry.name);
                    const destPathEntry = path.join(dest, entry.name);
                    if (entry.isDirectory()) {
                        await fs.mkdir(destPathEntry, { recursive: true });
                        await copyDir(srcPath, destPathEntry);
                    } else {
                        await fs.copyFile(srcPath, destPathEntry);
                    }
                }
            };
            await copyDir(sourcePath, destPath);

            // Register project
            const files = await fs.readdir(destPath);
            const mainFile = files.find(f => f.endsWith('.ino')) || `${example}.ino`;

            const newProject = {
                id: Math.random().toString(36).substring(2, 11),
                name: projectName,
                path: destPath,
                type: 'code',
                mainFile,
                lastModified: 'Just now'
            };

            projects.push(newProject);
            await saveProjects(projects);

            res.json({ success: true, project: newProject });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/arduino/libraries/install-zip', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const zipPath = req.file.path;
    try {
        // Try arduino-cli first
        try {
            console.log(`[Arduino] Attempting ZIP install via CLI: ${zipPath}`);
            await runArduinoCLI(['lib', 'install', '--zip-path', zipPath]);
            res.json({ success: true, message: 'Library installed from ZIP via CLI' });
            return;
        } catch (cliError) {
            console.warn(`[Arduino] CLI ZIP install failed, falling back to manual: ${cliError.message}`);
        }

        // Manual fallback
        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();

        // Find the library folder name (usually the first folder in ZIP)
        let libFolderName = path.basename(req.file.originalname, '.zip');
        if (zipEntries.length > 0) {
            const firstEntry = zipEntries[0].entryName.split('/')[0];
            if (firstEntry) libFolderName = firstEntry;
        }

        const targetPath = path.join(ARDUINO_LIBS_DIR, libFolderName);

        // Handle collisions
        let finalPath = targetPath;
        try {
            await fs.access(targetPath);
            const suffix = Date.now();
            finalPath = `${targetPath}_${suffix}`;
            console.log(`[Arduino] Collision detected, installing to ${finalPath}`);
        } catch (e) {
            // Path doesn't exist, good to go
        }

        zip.extractAllTo(ARDUINO_LIBS_DIR, true);

        // Validate
        const extractedPath = path.join(ARDUINO_LIBS_DIR, libFolderName);
        const entries = await fs.readdir(extractedPath);
        const hasProps = entries.includes('library.properties');
        const hasHeaders = entries.some(e => e.endsWith('.h') || e.endsWith('.hpp'));

        if (!hasProps && !hasHeaders) {
            throw new Error('Invalid library structure: no library.properties or headers found at root');
        }

        res.json({ success: true, message: `Library installed manually to ${libFolderName}` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        await fs.unlink(zipPath).catch(() => { });
    }
});

app.post('/api/arduino/cache/clear', async (req, res) => {
    try {
        // Selective clearing: only remove ZIPs for libraries that are NOT installed
        const installedLibs = await fs.readdir(ARDUINO_LIBS_DIR).catch(() => []);
        const libCacheDir = path.join(ARDUINO_DOWNLOADS_DIR, 'libraries');

        let removedCount = 0;
        try {
            const files = await fs.readdir(libCacheDir);
            for (const file of files) {
                const filePath = path.join(libCacheDir, file);
                const stats = await fs.stat(filePath);

                if (stats.isDirectory()) {
                    // If it's a directory in the cache, we can probably remove it if it's not an installed lib name
                    if (!installedLibs.includes(file)) {
                        await fs.rm(filePath, { recursive: true, force: true });
                        removedCount++;
                    }
                } else if (file.endsWith('.zip')) {
                    // For ZIPs, check if the library name (part before the first hyphen) is installed
                    const libName = file.split('-')[0];
                    if (!installedLibs.includes(libName)) {
                        await fs.unlink(filePath);
                        removedCount++;
                    }
                }
            }
        } catch (e) {
            // Directory might not exist
        }

        // Also clear the root downloads dir (usually temporary uploads)
        const rootFiles = await fs.readdir(ARDUINO_DOWNLOADS_DIR);
        for (const file of rootFiles) {
            const filePath = path.join(ARDUINO_DOWNLOADS_DIR, file);
            if (file === 'libraries') continue; // Skip the libraries subfolder we just processed

            const stats = await fs.stat(filePath);
            if (stats.isDirectory()) {
                await fs.rm(filePath, { recursive: true, force: true });
            } else {
                await fs.unlink(filePath);
            }
            removedCount++;
        }

        res.json({ success: true, removedCount });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
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
    const { code, usbSerial, projectRoot, currentFilePath, isReadOnly } = req.body;
    console.log(`[Flash] Request: usbSerial=${usbSerial}, projectRoot=${projectRoot}, isReadOnly=${isReadOnly}`);
    if (!code || !usbSerial) return res.status(400).json({ success: false, error: 'Missing args' });

    // 1. Acquire FLASHING lock (this will preempt MANUAL connection)
    const acquired = await portManager.acquire('FLASHING');
    if (!acquired) {
        return res.status(409).json({ success: false, error: 'Could not acquire port for flashing' });
    }

    const deviceToReconnect = connectedDevice;
    cancelReconnection();
    let tempDir = null;

    /**
     * Helper to run a command and stream progress
     */
    const runCommandWithProgress = (command, args, options = {}) => {
        const { startProgress = 0, endProgress = 100, stage = 'Processing' } = options;

        return new Promise((resolve, reject) => {
            const fullCommand = `${command} ${args.map(a => `"${a}"`).join(' ')}`;
            console.log(`[Flash] Running: ${fullCommand}`);
            const child = spawn(fullCommand, {
                cwd: options.cwd || process.cwd(),
                shell: true
            });
            let lastProgress = startProgress;

            // Broadcast initial progress for this stage
            broadcastToClients({
                type: 'flash-status',
                status: options.status || 'processing',
                message: options.message || stage,
                progress: startProgress
            });

            child.stdout.on('data', (data) => {
                const output = data.toString();

                // Also broadcast as raw arduino log
                broadcastToClients({
                    type: 'arduino-log',
                    data: output,
                    isError: false
                });

                // Split by newline or carriage return to handle progress updates (esptool uses \r)
                const lines = output.split(/[\r\n]+/);
                for (const line of lines) {
                    // Parse esptool progress: "(8 %)"
                    const match = line.match(/\((\d+)\s*%\)/);
                    if (match) {
                        const percent = parseInt(match[1]);
                        const mappedProgress = Math.round(startProgress + (percent / 100) * (endProgress - startProgress));

                        if (mappedProgress !== lastProgress) {
                            lastProgress = mappedProgress;
                            broadcastToClients({
                                type: 'flash-status',
                                status: options.status || 'processing',
                                message: options.message || stage,
                                progress: mappedProgress
                            });
                        }
                    }

                    // Parse compilation progress (arduino-cli compile --verbose)
                    if (stage === 'Compiling') {
                        if (line.includes('Compiling sketch...')) setProgress(15);
                        if (line.includes('Compiling libraries...')) setProgress(25);
                        if (line.includes('Compiling core...')) setProgress(35);
                        if (line.includes('Linking everything together...')) setProgress(38);
                    }
                }
            });

            function setProgress(val) {
                if (val > lastProgress) {
                    lastProgress = val;
                    broadcastToClients({
                        type: 'flash-status',
                        status: options.status || 'processing',
                        message: options.message || stage,
                        progress: val
                    });
                }
            }

            child.stderr.on('data', (data) => {
                const output = data.toString();
                console.error(`[Flash] ${stage} stderr: ${output}`);

                // Broadcast as raw arduino log instead of overwriting flash-status message
                broadcastToClients({
                    type: 'arduino-log',
                    data: output,
                    isError: true
                });
            });

            child.on('close', (code) => {
                if (code === 0) resolve();
                else {
                    const err = new Error(`Command failed with code ${code}`);
                    err.code = code;
                    reject(err);
                }
            });

            child.on('error', (err) => reject(err));
        });
    };

    try {
        const portPath = await findSerialPortPath(usbSerial);
        if (!portPath) throw new Error('Port not found');

        console.log(`[Flash] Starting flash on ${portPath}`);

        // Broadcast start
        broadcastToClients({
            type: 'flash-status',
            status: 'compiling',
            message: 'Starting flash process...',
            progress: 5
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
        const libPath = path.join(APP_ROOT, 'IA_firmware', 'arduino-libraries');

        const compileArgs = [
            'compile',
            '--clean',
            '--config-file', ARDUINO_YAML_PATH,
            '--fqbn', fqbn,
            '--verbose'
        ];

        // Only include product firmware libraries if not in read-only (example) mode
        if (!isReadOnly) {
            compileArgs.push('--libraries', libPath);
        }

        compileArgs.push(tempDir);

        broadcastToClients({ type: 'flash-status', status: 'compiling', message: 'Compiling...', progress: 10 });

        await runCommandWithProgress('arduino-cli', compileArgs, {
            startProgress: 10,
            endProgress: 40,
            stage: 'Compiling',
            status: 'compiling',
            message: 'Compiling...'
        });

        broadcastToClients({ type: 'flash-status', status: 'compiling', message: 'Compilation successful', progress: 40 });

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
                    message: attempt === 1 ? 'Uploading...' : `Retrying upload (Attempt ${attempt})...`,
                    progress: 40
                });

                if (attempt > 1) await sleep(1000); // Small gap between retries

                await runCommandWithProgress('arduino-cli', [
                    'upload',
                    '--config-file', ARDUINO_YAML_PATH,
                    '-p', normalizePortPath(portPath),
                    '--fqbn', fqbn,
                    tempDir
                ], { startProgress: 40, endProgress: 100, stage: 'Uploading', status: 'uploading', message: 'Uploading...' });

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

        broadcastToClients({ type: 'flash-status', status: 'success', message: 'Flash successful!', progress: 100 });

        // Give the UI a moment to show 100% before closing
        await sleep(1500);

        res.json({ success: true, message: 'Flash successful' });

    } catch (error) {
        console.error('[Flash] Error:', error);
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

            // Skip node_modules, .git, dist, and IA_firmware
            if (['node_modules', '.git', 'dist', 'IA_firmware'].includes(entry.name)) {
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

// API endpoint to list projects
app.get('/api/projects', async (req, res) => {
    try {
        const projects = await loadProjects();
        res.json({ success: true, projects });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API endpoint to create a new project
app.post('/api/projects/create', async (req, res) => {
    const { name, location } = req.body;
    if (!name || !location) {
        return res.status(400).json({ success: false, error: 'Name and location are required' });
    }

    // Validate name (no spaces or improper characters)
    const nameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!nameRegex.test(name)) {
        return res.status(400).json({
            success: false,
            error: 'Project name can only contain letters, numbers, underscores, and hyphens (no spaces).'
        });
    }

    try {
        const projectDir = path.join(location, name);
        const inoFile = path.join(projectDir, `${name}.ino`);

        // Check if directory already exists
        try {
            await fs.access(projectDir);
            return res.status(400).json({ success: false, error: 'Project directory already exists' });
        } catch (e) {
            // Directory does not exist, proceed
        }

        // Create directory
        await fs.mkdir(projectDir, { recursive: true });

        // Create .ino file with default content
        const defaultContent = `#include "incipe.h"

void setup () {
  incipe.init();
  Serial.begin(115200);
}

void loop () {
  incipe.main();
  Serial.println("hello world!");
}
`;
        await fs.writeFile(inoFile, defaultContent, 'utf-8');

        // Update projects list
        const projects = await loadProjects();
        const newProject = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            path: projectDir,
            type: 'code',
            lastModified: 'Just now'
        };
        projects.unshift(newProject);
        await saveProjects(projects);

        // Set as current project root
        currentProjectRoot = projectDir;

        res.json({ success: true, project: newProject });
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
