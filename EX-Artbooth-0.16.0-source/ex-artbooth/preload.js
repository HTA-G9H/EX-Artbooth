const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('exArtboothAPI', {
  openImage: () => ipcRenderer.invoke('dialog:openImage'),
  openProject: () => ipcRenderer.invoke('dialog:openProject'),
  saveDataUrl: (payload) => ipcRenderer.invoke('dialog:saveDataUrl', payload),
  saveText: (payload) => ipcRenderer.invoke('dialog:saveText', payload),
  chooseFolder: () => ipcRenderer.invoke('dialog:chooseFolder'),
  listTextures: () => ipcRenderer.invoke('textures:list'),
  openIccProfile: () => ipcRenderer.invoke('icc:open'),
  readIccProfile: (file) => ipcRenderer.invoke('icc:read', file),
  onMenuCommand: (callback) => ipcRenderer.on('menu-command', (_event, command) => callback(command))
});
