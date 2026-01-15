import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// Set name immediately to ensure correct path
app.setName('IA');

const logFile = path.join(app.getPath('userData'), 'app.log');

export function logToFile(message) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ${message}\n`;

    // Console log as well
    console.log(message);

    try {
        fs.appendFileSync(logFile, formattedMessage);
    } catch (err) {
        console.error('Failed to write to log file:', err);
    }
}

export function getLogPath() {
    return logFile;
}

// Clear log on startup if it's too large (> 5MB)
try {
    if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (stats.size > 5 * 1024 * 1024) {
            fs.writeFileSync(logFile, `[${new Date().toISOString()}] Log cleared (exceeded 5MB)\n`);
        }
    }
} catch (e) { }
