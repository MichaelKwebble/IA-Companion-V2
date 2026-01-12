const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    library: {
        checkUpdate: () => ipcRenderer.invoke('library:check-update'),
        update: (force) => ipcRenderer.invoke('library:update', force),
        getVersion: () => ipcRenderer.invoke('library:get-version')
    },
    project: {
        selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
        getDesktopPath: () => ipcRenderer.invoke('project:getDesktopPath')
    }
});

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector);
        if (element) element.innerText = text;
    };

    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type]);
    }
});
