# Sniffler - API Traffic Sniffing & Mocking Tool

## Overview

Sniffler is a cross-platform Electron desktop application designed for developers and testers. It provides real-time request sniffing, mocking, and regression testing capabilities for back-end APIs. Inspired by Postman but focused on intercepting and analyzing actual network traffic.

## Features

### ✅ Core Features (Implemented)

- **Multi-Port Sniffing**: Monitor multiple ports simultaneously with named projects
- **HTTP/HTTPS Proxying**: Intercept and analyze web traffic
- **Real-time Request Logging**: Live monitoring with filtering and search
- **Interactive Mock Management**: Save requests as reusable mocks
- **Modern UI**: React + Tailwind with dark mode support
- **Export/Import**: Save and share mock collections

### 🚧 In Development

- **Regression Testing**: Automated testing with diff comparison
- **Database Protocol Support**: PostgreSQL and MySQL sniffing
- **WebSocket Support**: Real-time connection monitoring
- **License Management**: Trial and premium features
- **Advanced Filtering**: Complex request filtering options

### 🔮 Planned Features

- **AI Mock Suggestions**: Intelligent endpoint recommendations
- **Custom Scripts**: Pre/post-request transformation
- **Team Collaboration**: Shared mock collections
- **CI/CD Integration**: Command-line companion tool

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn package manager

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/your-username/sniffler.git
   cd sniffler
   ```

2. **Install dependencies:**

   ```bash
   npm run install:all
   ```

3. **Start development mode:**

   ```bash
   npm run dev
   ```

   This will start both the renderer (React) and main (Electron) processes.

### Building for Production

```bash
# Build the renderer process
npm run build

# Create distribution packages
npm run dist
```

## Project Structure

```
sniffler/
├── apps/
│   ├── main/                 # Electron main process
│   │   ├── index.js         # Main app entry point
│   │   ├── proxy.js         # HTTP proxy implementation
│   │   └── preload.js       # IPC bridge
│   └── renderer/            # React frontend
│       ├── index.js         # React app
│       ├── index.html       # HTML template
│       └── index.css        # Tailwind styles
├── packages/
│   └── shared/              # Shared utilities
│       ├── types.js         # Type definitions
│       └── utils.js         # Helper functions
└── package.json             # Root package config
```

## Usage Guide

### 1. Setting Up a Proxy

1. Navigate to the **Proxies** tab
2. Click **"Add Proxy"**
3. Enter a name (e.g., "My API Project") and port number (e.g., 8080)
4. Click **"Start Proxy"**

### 2. Configuring Your Application

Configure your backend application to use the proxy:

#### Node.js/Express

```javascript
// Set HTTP proxy for your requests
process.env.HTTP_PROXY = "http://localhost:8080";
process.env.HTTPS_PROXY = "http://localhost:8080";
```

#### Python/Django

```python
# settings.py
PROXIES = {
    'http': 'http://localhost:8080',
    'https': 'http://localhost:8080',
}
```

#### .NET Core

```csharp
// Program.cs
services.Configure<HttpClientFactoryOptions>(options =>
{
    options.HttpClientActions.Add(client =>
    {
        client.DefaultRequestVersion = HttpVersion.Version11;
        // Configure proxy here
    });
});
```

### 3. Monitoring Traffic

1. Make requests from your application
2. View real-time traffic in the **Requests** tab
3. Filter by status, method, or search terms
4. Click **"View"** to see detailed request/response data

### 4. Creating Mocks

1. Find a successful request in the **Requests** tab
2. Click **"Save as Mock"**
3. The mock will appear in the **Mocks** tab
4. Future requests to the same endpoint will serve the mock response

### 5. Managing Mocks

- **View all mocks** in the Mocks tab
- **Enable/disable** individual mocks
- **Edit** mock responses
- **Export/import** mock collections for sharing

## Architecture

### Main Process (Node.js)

- **HTTP Proxy**: Uses `http-mitm-proxy` for intercepting requests
- **Mock Storage**: In-memory storage with export/import capabilities
- **IPC Communication**: Handles renderer process communication
- **Settings Management**: User preferences and license management

### Renderer Process (React)

- **Modern UI**: React 18 with hooks and functional components
- **Styling**: Tailwind CSS with dark mode support
- **State Management**: React useState and useEffect hooks
- **Real-time Updates**: IPC event listeners for live data

## Development

### Scripts

```bash
# Install all dependencies
npm run install:all

# Development mode (both processes)
npm run dev

# Build renderer only
npm run build

# Start main process only
npm run start

# Create distribution packages
npm run dist
```

### Adding Features

1. **Backend features**: Modify files in `apps/main/`
2. **UI features**: Modify files in `apps/renderer/`
3. **Shared utilities**: Add to `packages/shared/`

### IPC Communication

The app uses Electron's IPC for communication between processes:

```javascript
// Renderer to Main
const result = await window.electronAPI.startProxy({
  port: 8080,
  name: "Test",
});

// Main to Renderer (events)
window.electronAPI.onProxyRequest((data) => {
  console.log("New request:", data);
});
```

## Security Considerations

- **Local CA Certificate**: For HTTPS interception (requires user setup)
- **Data Storage**: All data stored locally, optional encryption planned
- **Network Access**: Only intercepts configured proxy traffic
- **Privacy**: No telemetry without explicit user consent

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Roadmap

### Version 1.0 (Current)

- [x] Basic proxy functionality
- [x] Request/response logging
- [x] Mock creation and management
- [x] Modern UI with dark mode
- [ ] Export/import refinements

### Version 1.1 (Next)

- [ ] Regression testing suite
- [ ] Database protocol support
- [ ] Advanced filtering options
- [ ] License management system

### Version 2.0 (Future)

- [ ] AI-powered mock suggestions
- [ ] Team collaboration features
- [ ] WebSocket support
- [ ] Custom scripting engine

## Support

- **Issues**: Report bugs and feature requests on GitHub Issues
- **Documentation**: Check the `/docs` folder for detailed guides
- **Community**: Join discussions in GitHub Discussions

---

**Built with ❤️ for the developer community**
