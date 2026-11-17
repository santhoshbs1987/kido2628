import { app, BrowserWindow, shell, session } from 'electron';
import path from 'path';
import { initDatabase, closeDatabase } from './db/database';
import { registerIpcHandlers } from './ipc/handlers';
import { BackupService } from './services/backup.service';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  // Enforce Content Security Policy (CSP)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: asset: file:; font-src 'self' data:; connect-src 'self' data:;"
        ]
      }
    });
  });

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'KIDO 2628 Retail App · POS & Inventory',
    icon: path.join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  // Security: block unauthorized navigation
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const isDev = process.env.NODE_ENV === 'development' || !!process.env['ELECTRON_RENDERER_URL'];
    const devUrl = process.env['ELECTRON_RENDERER_URL'];
    if (isDev && devUrl && navigationUrl.startsWith(devUrl)) {
      return;
    }
    if (navigationUrl.startsWith('file://')) {
      return;
    }
    event.preventDefault();
  });

  // Security: disallow creation of unvetted new browser windows
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // Register IPC handlers
  registerIpcHandlers(mainWindow);

  // Load renderer
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  // Initialize embedded SQLite database
  initDatabase();

  // Perform daily auto-backup snapshot
  try {
    BackupService.performDailyAutoBackup();
  } catch (e) {
    console.error('Initial auto backup check failed:', e);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
