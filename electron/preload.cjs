// electron/preload.cjs
// =============================================================================
// Preload bridge. Exposes a narrow, named IPC surface to the renderer.
//
// Why not expose raw `send` / `on`:
//   Any renderer code (including a compromised third-party script inside a
//   loaded provider view) would then be able to reach any IPC channel. Named
//   methods keep the privileged surface explicit and auditable.
//
// The renderer passes a *provider key* (e.g. "gmail"), never a URL. The URL is
// resolved in main.cjs from the PROVIDERS allowlist.
// =============================================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Open (or focus) a provider's unified-inbox view.
   * @param {string} provider  One of the keys in main.cjs PROVIDERS.
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  openService: (provider) => ipcRenderer.invoke('open-service', { provider }),

  /**
   * Close and destroy a provider's view.
   * @param {string} provider
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  closeService: (provider) => ipcRenderer.invoke('close-service', { provider }),

  /**
   * List currently-open provider keys.
   * @returns {Promise<{ ok: boolean, providers: string[] }>}
   */
  listServices: () => ipcRenderer.invoke('list-services'),
});