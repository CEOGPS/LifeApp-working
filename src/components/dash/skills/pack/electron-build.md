---
name: electron-build
description: Build LifeOS1 as an Electron desktop app. Use when the user wants to package the app for Windows/Mac/Linux.
disable-model-invocation: true
---

Build the Electron desktop app using the ELECTRON=true flag (required for relative base paths under the file:// protocol):

On Windows (PowerShell):
```
$env:ELECTRON="true"; bun run build; electron-builder
```

On Mac/Linux:
```
ELECTRON=true bun run build && electron-builder
```

Output goes to `dist-electron/`.

Targets:
- Windows: NSIS installer
- Mac: .dmg
- Linux: AppImage

For dev mode (hot reload with Electron window): `bun run electron:dev`
