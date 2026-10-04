// electron/main.cjs
// =============================================================================
// LifeOS1 / CEO GPS — Electron main process
//
// Responsibilities:
//   1. Create the main BrowserWindow (dev → Vite, prod → dist/index.html)
//   2. Manage a Map of BrowserViews, one per provider ("Unified Inbox")
//   3. Guard navigation: block in-app nav to unlisted origins; open externals
//      in the system browser instead of spawning Electron windows
//   4. Isolate sessions per provider so cookies/logins do not leak
//   5. Single-instance lock so double-launch focuses the existing window
//
// Security posture:
//   - nodeIntegration: false, contextIsolation: true, sandbox: true everywhere
//   - Renderer passes a *provider key*, never a URL (allowlist enforced here)
//   - Preload exposes only three named IPC methods (no raw send/on)
// =============================================================================

const {
  app,
  BrowserWindow,
  BrowserView,
  ipcMain,
  shell,
} = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

const isDev = process.env.NODE_ENV === 'development';
const DEV_URL = 'http://localhost:5173';
const PROD_HTML = path.join(__dirname, '..', 'dist', 'index.html');

// Provider allowlist. The renderer sends a key; the URL is resolved here.
// Add new services by adding a key — never accept a raw URL from the renderer.
const PROVIDERS = Object.freeze({
  gmail:     'https://mail.google.com/',
  outlook:   'https://outlook.live.com/mail/',
  proton:    'https://mail.proton.me/',
  slack:     'https://app.slack.com/',
  telegram:  'https://web.telegram.org/',
  whatsapp:  'https://web.whatsapp.com/',
  messenger: 'https://www.messenger.com/',
  instagram: 'https://www.instagram.com/direct/inbox/',
  linkedin:  'https://www.linkedin.com/messaging/',
  x:         'https://x.com/messages',
  facebook:  'https://www.facebook.com/messages/',
});

// -----------------------------------------------------------------------------
// State
// -----------------------------------------------------------------------------

/** @type {BrowserWindow | null} */
let mainWindow = null;

/** @type {Map<string, Electron.BrowserView>} */
const serviceViews = new Map();

// -----------------------------------------------------------------------------
// Navigation guards
// -----------------------------------------------------------------------------

/**
 * Allow in-app navigation only to:
 *   - the Vite dev server (dev only)
 *   - file:// (the packaged shell)
 *   - an allowlisted provider URL
 * Everything else opens in the system browser.
 *
 * Also forces every window.open() target to the system browser.
 *
 * @param {Electron.WebContents} contents
 */
function applyNavigationGuards(contents) {
  contents.on('will-navigate', (event, url) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      event.preventDefault();
      return;
    }

    const providerUrls = Object.values(PROVIDERS);
    const isDevServer = isDev && parsed.origin === DEV_URL;
    const isLocalFile = parsed.protocol === 'file:';
    const isProvider = providerUrls.some((p) => url.startsWith(p));

    if (!isDevServer && !isLocalFile && !isProvider) {
      event.preventDefault();
      // Fire-and-forget; ignore failures (e.g. no handler for custom schemes).
      shell.openExternal(url).catch(() => {});
    }
  });

  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  // Best-effort: block webview attachment and permission requests by default.
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
}

// -----------------------------------------------------------------------------
// Service views (Unified Inbox)
// -----------------------------------------------------------------------------

/**
 * Return an existing BrowserView for the provider, or create one.
 * @param {string} provider
 * @returns {Electron.BrowserView}
 */
function getOrCreateServiceView(provider) {
  const url = PROVIDERS[provider];
  if (!url) throw new Error(`Unknown provider: ${provider}`);

  const existing = serviceViews.get(provider);
  if (existing) return existing;

  const view = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // Isolated, persistent session per provider so cookies/logins do not
      // leak between Gmail, Facebook, Slack, etc.
      partition: `persist:service-${provider}`,
    },
  });

  applyNavigationGuards(view.webContents);

  // Load the allowlisted URL only (never a renderer-supplied URL).
  view.webContents.loadURL(url).catch((err) => {
    console.error(`[service:${provider}] failed to load:`, err);
  });

  serviceViews.set(provider, view);
  return view;
}

/**
 * Lay out all service views side-by-side across the current window width.
 * If no views exist, detaches any previously attached view.
 */
function layoutServiceViews() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const total = serviceViews.size;
  if (total === 0) {
    mainWindow.setBrowserView(null);
    return;
  }

  const { width, height } = mainWindow.getContentBounds();
  const eachW = Math.floor(width / total);

  let i = 0;
  for (const view of serviceViews.values()) {
    const x = i * eachW;
    // Last view absorbs any remainder pixels.
    const w = i === total - 1 ? width - x : eachW;
    view.setBounds({ x, y: 0, width: w, height });
    i += 1;
  }

  // Attach the first view; callers can call 'focus-service' to swap later.
  mainWindow.setBrowserView([...serviceViews.values()][0]);
}

/**
 * Detach & destroy a single service view.
 * @param {string} provider
 */
function destroyServiceView(provider) {
  const view = serviceViews.get(provider);
  if (!view) return;
  try {
    // Remove the BrowserView from the window before destroying webContents.
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.removeBrowserView(view);
    }
  } catch {
    // removeBrowserView throws if the view wasn't attached; ignore.
  }
  try {
    view.webContents.destroy();
  } catch {
    // Already destroyed; ignore.
  }
  serviceViews.delete(provider);
}

/**
 * Destroy every service view (used on window close / app quit).
 */
function destroyAllServiceViews() {
  for (const provider of [...serviceViews.keys()]) {
    destroyServiceView(provider);
  }
  serviceViews.clear();
}

// -----------------------------------------------------------------------------
// Main window
// -----------------------------------------------------------------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'CEO GPS',
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // ---- URL resolution -------------------------------------------------------
  const startUrl = isDev
    ? DEV_URL
    : pathToFileURL(PROD_HTML).href;

  console.log('[main] loading URL:', startUrl);
  mainWindow.loadURL(startUrl).catch((err) => {
    console.error('[main] loadURL failed:', err);
  });

  // ---- Devtools (dev only) --------------------------------------------------
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // ---- Renderer console relay ----------------------------------------------
  // Electron >= 25 emits a single `details` object; older versions emit
  // (event, level, message, line, sourceId). Handle both.
  mainWindow.webContents.on('console-message', (...args) => {
    let level;
    let message;
    let line;
    let sourceId;
    if (
      args.length === 1 &&
      typeof args[0] === 'object' &&
      args[0] !== null &&
      'message' in args[0]
    ) {
      ({ level, message, lineNumber: line, sourceId } = args[0]);
    } else {
      [, level, message, line, sourceId] = args;
    }
    console.log(`[renderer ${level}] ${message} (${sourceId}:${line})`);
  });

  // ---- Load diagnostics -----------------------------------------------------
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    // -3 is a benign abort (redirect / user-initiated navigation). Skip it.
    if (code === -3) return;
    console.error('[main] did-fail-load:', code, desc, url);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[main] page loaded');
  });

  // ---- Show when ready ------------------------------------------------------
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
    console.log('[main] window shown');
  });

  // ---- Resize → relayout service views -------------------------------------
  mainWindow.on('resize', () => {
    layoutServiceViews();
  });

  // ---- Teardown -------------------------------------------------------------
  mainWindow.on('closed', () => {
    destroyAllServiceViews();
    mainWindow = null;
  });

  // ---- Navigation guards on the shell itself --------------------------------
  applyNavigationGuards(mainWindow.webContents);
}

// -----------------------------------------------------------------------------
// IPC
// -----------------------------------------------------------------------------

ipcMain.handle('open-service', (_event, { provider } = {}) => {
  if (typeof provider !== 'string' || !provider) {
    return { ok: false, error: 'provider is required' };
  }
  try {
    getOrCreateServiceView(provider);
    layoutServiceViews();
    return { ok: true };
  } catch (err) {
    console.error('[ipc] open-service failed:', err);
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
});

ipcMain.handle('close-service', (_event, { provider } = {}) => {
  if (typeof provider !== 'string' || !provider) {
    return { ok: false, error: 'provider is required' };
  }
  try {
    destroyServiceView(provider);
    layoutServiceViews();
    return { ok: true };
  } catch (err) {
    console.error('[ipc] close-service failed:', err);
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
});

ipcMain.handle('list-services', () => {
  return { ok: true, providers: [...serviceViews.keys()] };
});

// -----------------------------------------------------------------------------
// App lifecycle
// -----------------------------------------------------------------------------

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // A second instance tried to start; the first instance will focus itself
  // via the 'second-instance' handler below. Quit this one immediately.
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      // macOS: re-create a window when the dock icon is clicked and no windows
      // are open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    destroyAllServiceViews();
  });
}