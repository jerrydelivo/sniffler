const { app, BrowserWindow } = require("electron");

console.log("🚀 Starting minimal Electron test...");

function createTestWindow() {
  console.log("🖥️ Creating test window...");

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  console.log("✅ BrowserWindow created successfully");

  win.loadURL("https://www.google.com");

  console.log("📄 Loading Google in window");

  win.webContents.on("did-finish-load", () => {
    console.log("✅ Window loaded successfully!");
  });

  win.on("closed", () => {
    console.log("🔥 Window closed");
  });
}

app.whenReady().then(() => {
  console.log("⚡ Electron app ready, creating window...");
  createTestWindow();
});

app.on("window-all-closed", () => {
  console.log("🛑 All windows closed, quitting app");
  app.quit();
});
