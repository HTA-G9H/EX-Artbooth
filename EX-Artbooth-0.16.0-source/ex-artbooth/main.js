const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#101319',
    title: 'EX Artbooth',
    icon: path.join(__dirname, 'app', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));

  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'Home (Recent Projects)', accelerator: 'CmdOrCtrl+H', click: () => sendMenu('home') },
        { type: 'separator' },
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => sendMenu('new') },
        { label: 'Open Image...', accelerator: 'CmdOrCtrl+O', click: () => sendMenu('open-image') },
        { label: 'Import Image as Layer...', accelerator: 'CmdOrCtrl+Shift+O', click: () => sendMenu('import-layer') },
        { type: 'separator' },
        { label: 'Open EX Artbooth Project...', click: () => sendMenu('open-project') },
        { label: 'Save EX Artbooth Project...', accelerator: 'CmdOrCtrl+S', click: () => sendMenu('save-project') },
        { type: 'separator' },
        // One entry: the dialog itself carries the PNG / JPEG / PSD switch.
        { label: 'Export...', accelerator: 'CmdOrCtrl+E', click: () => sendMenu('export') },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => sendMenu('undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', click: () => sendMenu('redo') },
        { type: 'separator' },
        { label: 'Apply Crop', accelerator: 'Enter', click: () => sendMenu('apply-crop') },
        { label: 'Cancel Crop', accelerator: 'Esc', click: () => sendMenu('cancel-crop') },
        { type: 'separator' },
        { label: 'Resize Canvas...', click: () => sendMenu('resize') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Fit to Window', accelerator: 'CmdOrCtrl+0', click: () => sendMenu('fit') },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: () => sendMenu('zoom-in') },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => sendMenu('zoom-out') },
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'About EX Artbooth', click: () => dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'EX Artbooth',
          message: 'EX Artbooth 0.16.0',
          detail: 'A free Photoshop-style editor MVP. Built with Electron and HTML Canvas.'
        }) }
      ]
    }
  ]);

  Menu.setApplicationMenu(menu);
}

function sendMenu(command) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('menu-command', command);
  }
}

function mimeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.bmp') return 'image/bmp';
  return 'image/png';
}

ipcMain.handle('textures:list', async () => {
  try {
    const manifestPath = path.join(__dirname, 'app', 'textures', 'textures.json');
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const data = JSON.parse(raw);
    const textures = Array.isArray(data.textures) ? data.textures : [];
    return textures.filter((entry) => entry && entry.id && entry.file
      && fs.existsSync(path.join(__dirname, 'app', 'textures', entry.file)));
  } catch (_err) {
    return [];
  }
});

ipcMain.handle('dialog:openImage', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open image',
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] },
      { name: 'All files', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const buffer = fs.readFileSync(filePath);
  return {
    name: path.basename(filePath),
    path: filePath,
    dataUrl: `data:${mimeFromPath(filePath)};base64,${buffer.toString('base64')}`
  };
});

ipcMain.handle('dialog:openProject', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open EX Artbooth project',
    properties: ['openFile'],
    filters: [
      { name: 'EX Artbooth Project', extensions: ['exart', 'openpixel', 'json'] },
      { name: 'All files', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  return {
    name: path.basename(filePath),
    path: filePath,
    text: fs.readFileSync(filePath, 'utf8')
  };
});

ipcMain.handle('dialog:chooseFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose default folder',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return { path: result.filePaths[0] };
});

ipcMain.handle('icc:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose an ICC colour profile',
    filters: [{ name: 'ICC Colour Profile', extensions: ['icc', 'icm'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const file = result.filePaths[0];
  try {
    const buffer = fs.readFileSync(file);
    if (buffer.length > 8 * 1024 * 1024) return { error: 'tooLarge' };
    return { path: file, name: path.basename(file), base64: buffer.toString('base64') };
  } catch (err) {
    return { error: String(err && err.message ? err.message : err) };
  }
});

ipcMain.handle('icc:read', async (_event, file) => {
  try {
    const buffer = fs.readFileSync(file);
    return { path: file, name: path.basename(file), base64: buffer.toString('base64') };
  } catch (err) {
    return null;
  }
});

ipcMain.handle('dialog:saveDataUrl', async (_event, payload) => {
  const { defaultPath, dataUrl, filters } = payload;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save file',
    defaultPath,
    filters: filters || [{ name: 'All files', extensions: ['*'] }]
  });
  if (result.canceled || !result.filePath) return null;
  const base64 = dataUrl.split(',')[1];
  fs.writeFileSync(result.filePath, Buffer.from(base64, 'base64'));
  return { path: result.filePath };
});

ipcMain.handle('dialog:saveText', async (_event, payload) => {
  const { defaultPath, text, filters } = payload;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save file',
    defaultPath,
    filters: filters || [{ name: 'All files', extensions: ['*'] }]
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, text, 'utf8');
  return { path: result.filePath };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
