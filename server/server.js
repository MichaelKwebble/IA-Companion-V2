import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const app = express();
const PORT = 3001;

// Enable CORS for frontend communication
app.use(cors());
app.use(express.json());

// Target USB identifiers for ESP32-S3
const TARGET_VENDOR_ID = 12346;  // 0x303A in decimal
const TARGET_PRODUCT_ID = 4097;  // 0x1001 in decimal

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

// API endpoint to get detected devices
app.get('/api/devices', async (req, res) => {
    try {
        const devices = await detectDevices();
        res.json({
            success: true,
            count: devices.length,
            devices: devices
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

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 Device detection server running on http://localhost:${PORT}`);
    console.log(`📡 Monitoring for ESP32-S3 devices (VID: 0x303A, PID: 0x1001)`);
    console.log(`🔍 Query devices at: http://localhost:${PORT}/api/devices`);
});
