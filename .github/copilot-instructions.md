# Copilot Project Instructions for Sniffler

## Project Overview

- Cross-platform Electron desktop app for developers/testers, inspired by Postman, focused on real-time request sniffing, mocking, and regression testing for back-end APIs.
- UI: React + Tailwind (renderer process)
- Proxy/sniffer/mocking logic: Node.js (main process)
- Monorepo with npm workspaces

## Development Environment

- **Platform**: Windows 11
- **Project Structure**: Main project is located inside the `sniffler` folder
- **Working Directory**: Always use `c:\Users\deliv\Nose\sniffler` as the base path
- **Development Commands**:
  - Start app: `cd c:\Users\deliv\Nose\sniffler; npm run dev`
  - Main process only: `cd c:\Users\deliv\Nose\sniffler; npm run start --workspace=apps/main`
  - Renderer only: `cd c:\Users\deliv\Nose\sniffler; npm run dev --workspace=apps/renderer`

## Current Implementation Status

### ✅ Completed Features

- Multi-port HTTP/HTTPS proxying with http-mitm-proxy
- Real-time request/response logging and filtering
- Mock creation, editing, and management
- Settings persistence and configuration
- Auto-save requests as mocks (configurable setting)
- Testing mode (mocks only served during regression tests)
- Import/export functionality
- Dark mode support
- Modern React + Tailwind UI

### 🔧 Key Architecture Decisions

- **Mocking Strategy**: Mocks are only served when manually enabled; auto-saved mocks are disabled by default
- **Auto-save**: Successful responses (2xx status codes) automatically create **disabled** mocks when enabled in settings
- **Testing Mode**: Testing always hits real backend servers to validate they're working correctly
- **Mock Validation**: Tests compare real backend responses with saved mocks to detect discrepancies
- **Event-driven**: Main process listens for proxy events to handle mock persistence and real-time updates

## Core Features

- Multi-port sniffing (user-configurable, named, grouped by project)
- HTTP/HTTPS proxying (with CA install guidance)
- Basic DB protocol sniffing (PostgreSQL, MySQL; document limitations)
- Real-time request/response logging, filtering, sorting
- Interactive mock saving, editing, organizing, searching, import/export
- Mocking, replay, regression testing (with diff, rollbacked DB transactions)
- Licensing: 30-day trial, in-app purchase, team management
- Modern, responsive UI, dark mode, onboarding, docs, troubleshooting
- Advanced: AI mock suggestions, diff viewer, WebSocket support, custom scripts, audit trail, project org, user prefs, notifications, keyboard shortcuts

## Technical/Workflow Notes

- Use robust open-source proxy libraries (http-mitm-proxy, node-http-proxy)
- Store sensitive data securely, with optional encryption
- All license validation runs client-side, with periodic online check
- Plugin-friendly architecture for future extensibility
- Use Git for version control of mock data
- CLI companion tool for CI/CD (optional)
- Opt-in telemetry (optional)

## Setup/Best Practices

- Use npm workspaces for monorepo
- Electron Forge/Builder for packaging
- Jest for unit tests, Playwright/Spectron for E2E
- Store all generated code in the correct workspace subfolders
- Document any technical limitations or required manual steps

## Outstanding Tasks

- Scaffold and connect proxy/sniffer backend logic
- Build main UI shell (sidebar, project/mocks/logs views)
- Implement onboarding, licensing, and advanced features
- Ensure Tailwind build and React/Electron integration works
- Add tests and documentation

---

_Keep this file up to date as project requirements or architecture evolve._
