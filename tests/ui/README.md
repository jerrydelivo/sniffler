# UI Integration Tests

This directory contains tests that verify the UI corresponds with the backend functionality. These tests use a combination of:

- **JSDOM** for DOM manipulation testing
- **React Testing Library** for component testing
- **Mock Electron APIs** for simulating Electron environment
- **Real Docker containers** for database and API testing

## Test Categories

1. **Component Tests** - Individual React component testing
2. **View Integration Tests** - Full view functionality with mocked backend
3. **End-to-End UI Tests** - UI interactions with real backend services
4. **Database UI Tests** - Database proxy management through UI
5. **Real-time Updates** - WebSocket and IPC event handling

## Running Tests

```bash
# All UI tests
npm run test:ui

# Specific categories
npm run test:ui:components
npm run test:ui:integration
npm run test:ui:e2e
npm run test:ui:database
```
