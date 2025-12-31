import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import isDev from 'electron-is-dev';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import AdmZip from 'adm-zip';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    const startUrl = isDev
        ? 'http://localhost:5173'
        : `file://${path.join(__dirname, '../dist/index.html')}`;

    win.loadURL(startUrl);

    if (isDev) {
        win.webContents.openDevTools();
    }
}

class LibraryUpdater {
    constructor() {
        this.updateUrl = 'https://ia-mainboard-pat.vercel.app/api/myproduct-latest';
        this.baseDir = path.join(app.getAppPath(), 'IA_firmware');
        this.libDir = path.join(this.baseDir, 'arduino-libraries');
        this.incipeDir = path.join(this.libDir, 'incipe');
        this.versionFile = path.join(this.baseDir, 'version.json');
    }

    async ensureDirs() {
        await fs.mkdir(this.libDir, { recursive: true });
    }

    async getLocalVersion() {
        try {
            const data = await fs.readFile(this.versionFile, 'utf-8');
            return JSON.parse(data).version;
        } catch (e) {
            return null;
        }
    }

    async checkForUpdates() {
        try {
            const response = await fetch(this.updateUrl);
            const data = await response.json();
            const localVersion = await this.getLocalVersion();
            return {
                available: data.version !== localVersion,
                latestVersion: data.version,
                downloadUrl: data.downloadUrl
            };
        } catch (error) {
            console.error('[LibraryUpdater] Check failed:', error);
            throw error;
        }
    }

    async downloadAndInstall(force = false) {
        try {
            const updateInfo = await this.checkForUpdates();
            if (!updateInfo.available && !force) {
                return { success: true, message: 'Already up to date' };
            }

            console.log(`[LibraryUpdater] Downloading ${updateInfo.latestVersion}...`);
            const response = await fetch(updateInfo.downloadUrl);
            if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);

            const tempZip = path.join(os.tmpdir(), `incipe-${Date.now()}.zip`);
            const fileStream = createWriteStream(tempZip);
            await pipeline(response.body, fileStream);

            console.log('[LibraryUpdater] Extracting...');
            const zip = new AdmZip(tempZip);
            const tempExtractDir = path.join(os.tmpdir(), `incipe-extract-${Date.now()}`);
            await fs.mkdir(tempExtractDir, { recursive: true });
            zip.extractAllTo(tempExtractDir, true);

            // Find the incipe folder inside the extracted archive
            // GitHub archives usually have a root folder like repo-name-tag/
            const entries = await fs.readdir(tempExtractDir, { withFileTypes: true });
            const rootFolderEntry = entries.find(e => e.isDirectory());
            if (!rootFolderEntry) throw new Error('Could not find root folder in the archive');

            const rootFolder = rootFolderEntry.name;
            const sourceIncipeDir = path.join(tempExtractDir, rootFolder, 'incipe');

            // Verify source exists
            try {
                await fs.access(sourceIncipeDir);
            } catch (e) {
                throw new Error('Could not find "incipe" folder in the archive');
            }

            console.log('[LibraryUpdater] Installing to', this.incipeDir);
            await fs.rm(this.incipeDir, { recursive: true, force: true });
            await fs.mkdir(this.libDir, { recursive: true });

            // Copy incipe folder
            await this.copyDir(sourceIncipeDir, this.incipeDir);

            // Wrap everything in a src folder to support 1.5 format 
            // while preserving "src/" prefix in includes
            await this.wrapInSrc();

            // Ensure library.properties exists for new-style library support
            await this.ensureLibraryProperties(updateInfo.latestVersion);

            // Save version
            await fs.writeFile(this.versionFile, JSON.stringify({ version: updateInfo.latestVersion }));

            // Cleanup
            await fs.rm(tempZip, { force: true });
            await fs.rm(tempExtractDir, { recursive: true, force: true });

            console.log('[LibraryUpdater] Update complete');
            return { success: true, version: updateInfo.latestVersion };
        } catch (error) {
            console.error('[LibraryUpdater] Update failed:', error);
            return { success: false, error: error.message };
        }
    }

    async copyDir(src, dest) {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                await this.copyDir(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    }

    async ensureLibraryProperties(version) {
        const propsPath = path.join(this.incipeDir, 'library.properties');
        const nestedPropsPath = path.join(this.incipeDir, 'src', 'library.properties');

        // If library.properties was moved into src during wrapping, move it back to root
        try {
            await fs.access(nestedPropsPath);
            await fs.rename(nestedPropsPath, propsPath);
            console.log('[LibraryUpdater] Moved library.properties from src to root');
            return;
        } catch (e) { }

        try {
            await fs.access(propsPath);
            console.log('[LibraryUpdater] library.properties already exists');
        } catch (e) {
            console.log('[LibraryUpdater] Creating library.properties...');
            const content = [
                'name=incipe',
                `version=${version || '0.0.1'}`,
                'author=Incipe',
                'maintainer=Incipe',
                'sentence=Incipe mainboard support',
                'paragraph=Internal library for the IA Kit mainboard.',
                'category=Signal Input/Output',
                'url=https://example.com',
                'architectures=*'
            ].join('\n');
            await fs.writeFile(propsPath, content);
        }
    }

    async wrapInSrc() {
        console.log('[LibraryUpdater] Wrapping library in src folder...');
        const tempDir = path.join(os.tmpdir(), `incipe-wrap-${Date.now()}`);
        await fs.mkdir(tempDir, { recursive: true });

        // Move everything from incipeDir to tempDir
        const entries = await fs.readdir(this.incipeDir);
        for (const entry of entries) {
            await fs.rename(path.join(this.incipeDir, entry), path.join(tempDir, entry));
        }

        // Create src folder
        const newSrcDir = path.join(this.incipeDir, 'src');
        await fs.mkdir(newSrcDir, { recursive: true });

        // Move everything back into incipeDir/src/
        const tempEntries = await fs.readdir(tempDir);
        for (const entry of tempEntries) {
            await fs.rename(path.join(tempDir, entry), path.join(newSrcDir, entry));
        }

        // Cleanup tempDir
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

const updater = new LibraryUpdater();

ipcMain.handle('library:check-update', () => updater.checkForUpdates());
ipcMain.handle('library:update', (event, force) => updater.downloadAndInstall(force));
ipcMain.handle('library:get-version', () => updater.getLocalVersion());

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
