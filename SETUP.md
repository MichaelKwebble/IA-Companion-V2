# Setup Instructions for New Developers

## Prerequisites
- Node.js and npm installed
- Git installed

## Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "IA Companion V2"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   *Note: This will automatically install both the frontend and backend (server) dependencies.*

3. **Run the development server**
   ```bash
   npm run electron:dev
   ```

## First-Time Arduino Setup

The app will start with a "Smart Home UI" placeholder project. To work with ESP32 devices:

### Install ESP32 Board Manager

1. Open any project in the IDE
2. Click the **"Boards Manager"** button (or menu option)
3. Search for **"esp32"**
4. Click **"Install"** on the ESP32 package
5. Wait for download and installation to complete

> **Note:** This only needs to be done **once per computer**. The app manages this in its local `arduino/` directory.

### Install Libraries (if needed)

1. Click the **"Library Manager"** button
2. Search for the library you need
3. Click **"Install"**

## Projects Configuration

The repository includes a `projects.json` file with a "Smart Home UI" placeholder:
- You can add your own projects through the app
- Your project list is **local to your computer**
- Changes to `projects.json` are **not synced** to GitHub

## What's Included vs What's Downloaded

### ✅ Included in Git (synced across all computers)
- Application source code (~160 files)
- Arduino configuration structure
- `projects.json` with "Smart Home UI" placeholder

### ❌ Not Included in Git (downloaded/managed per-computer)
- **Node modules** - Install with `npm install`
- **ESP32 board manager** - Install through app's Boards Manager
- **Arduino libraries** - Install through app's Library Manager
- **Your local projects** - Managed locally in `projects.json`
- **Product firmware** - Downloaded from Vercel when needed

## Development Workflow

```bash
# Start the dev server
npm run electron:dev

# Make code changes
# Test your changes

# Commit and push (only source code changes)
git add .
git commit -m "Your changes"
git push
```

## Notes for Developers

- **Don't worry about Arduino files** - They're git-ignored and managed per-computer
- **Your `projects.json` changes won't be tracked** - Add projects freely without affecting others
- **First-time setup takes a few minutes** - ESP32 download is ~200MB, but only once
- **The app is self-contained** - All Arduino tools are managed in the `arduino/` directory

## Troubleshooting

### "Board not found" or "Library not found"
1. Open Boards Manager or Library Manager
2. Search and install the required package
3. Restart the app if needed

### Can't upload to ESP32
1. Ensure ESP32 board manager is installed
2. Check the correct board is selected
3. Ensure the serial port is not in use by another app

### App runs slowly or freezes
1. Check that only one instance of the app is running
2. Ensure the ESP32 device is not spamming serial data
3. Try restarting the app

## Getting Help

If you encounter issues:
1. Check the console for error messages
2. Verify ESP32 board manager is installed
3. Ensure all npm dependencies are up to date: `npm install`
4. **Windows Users:** If `npm install` fails, you may need to install "Build Tools for Visual Studio" to compile native modules like `serialport`.
5. **Mac Users:** Ensure you have Xcode Command Line Tools installed: `xcode-select --install`.
6. Ask the team for help with specific errors.

---

**Welcome to the team!** 🎉
