# apps/renderer

React user interface for Sniffler.

Key areas:

- Requests: live table, filters, detail pane (headers/body/timing)
- Mocks: create, edit, enable/disable, import/export collections
- Settings: proxy ports, HTTPS CA guidance, theme, license status

Built with React + Tailwind. Consumes events from the main process via IPC/websocket bridge.
