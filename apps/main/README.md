# apps/main

Electron main process:

- Boots the app window(s) and wires preload
- Runs the HTTP/HTTPS MITM proxy (http-mitm-proxy)
- Applies mock rules and orchestrates request/response capture
- Provides IPC channels/WebSocket to stream events to the renderer
- Handles app lifecycle, settings, and license checks
