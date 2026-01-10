import { app, BrowserWindow, ipcMain, dialog } from 'electron';
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
        console.log('[LibraryUpdater] Reorganizing library structure...');

        const outerSrcDir = path.join(this.incipeDir, 'src');
        const innerSrcDir = path.join(outerSrcDir, 'src');
        const tmpSrcDir = path.join(this.incipeDir, 'tmp_src');

        // 1. If 'src' exists, rename it to 'tmp_src' so we can reorganize its contents
        try {
            await fs.access(outerSrcDir);
            await fs.rename(outerSrcDir, tmpSrcDir);
        } catch (e) {
            // 'src' doesn't exist, that's fine
        }

        // 2. Create the new nested structure
        await fs.mkdir(innerSrcDir, { recursive: true });

        // 3. Define where things should go
        const outerItems = ['DataPacket.h', 'incipe.cpp', 'incipe.h', 'incipe.ino'];
        const innerItems = ['application', 'module', 'screen', 'SensorSync.cpp', 'SensorSync.h'];

        // 4. Function to move items to correct location
        const distributeItems = async (dir) => {
            try {
                const entries = await fs.readdir(dir);
                for (const entry of entries) {
                    if (entry === 'src' || entry === 'tmp_src') continue;

                    const oldPath = path.join(dir, entry);
                    if (outerItems.includes(entry)) {
                        await fs.rename(oldPath, path.join(outerSrcDir, entry));
                    } else if (innerItems.includes(entry)) {
                        await fs.rename(oldPath, path.join(innerSrcDir, entry));
                    } else if (dir === this.incipeDir && entry !== 'library.properties') {
                        // If it's something else in the root (except library.properties), 
                        // move it to inner src to be safe/compact
                        await fs.rename(oldPath, path.join(innerSrcDir, entry));
                    }
                }
            } catch (e) {
                // Directory might not exist or be empty
            }
        };

        // 5. Reorganize from root and tmp_src
        await distributeItems(this.incipeDir);
        await distributeItems(tmpSrcDir);

        // 6. Cleanup
        try {
            await fs.rm(tmpSrcDir, { recursive: true, force: true });
        } catch (e) { }
    }
}

const updater = new LibraryUpdater();

ipcMain.handle('library:check-update', () => updater.checkForUpdates());
ipcMain.handle('library:update', (event, force) => updater.downloadAndInstall(force));
ipcMain.handle('library:get-version', () => updater.getLocalVersion());

ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    if (canceled) {
        return null;
    } else {
        return filePaths[0];
    }
});

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
