# Sniffler Auto-Update System

Sniffler now includes automatic update functionality that will notify users when new versions are available and allow them to update seamlessly.

## How It Works

### 1. **Automatic Update Checks**
- Sniffler checks for updates every 24 hours by default
- Checks happen in the background without interrupting the user
- First check occurs 5 seconds after app startup

### 2. **Update Process**
When a new version is detected:
1. **Notification**: User gets a dialog asking if they want to download
2. **Download**: Update is downloaded in the background with progress indicator
3. **Install**: User is prompted to restart and install the update
4. **Restart**: App restarts automatically with the new version

### 3. **User Control**
Users can:
- **Check manually**: Via Help → Check for Updates menu
- **Download now**: Immediate download with progress dialog
- **Download later**: Background download, install when ready
- **Skip version**: Wait for the next update check

## Configuration

### App Settings
The auto-updater behavior can be configured in app settings:

```javascript
{
  autoCheckForUpdates: true,     // Enable automatic checking
  updateCheckInterval: 24,       // Check every 24 hours  
  autoDownloadUpdates: false,    // Ask before downloading
  autoInstallUpdates: false      // Ask before installing
}
```

### For Developers

#### 1. **Update Repository Info**
Edit `apps/main/auto-updater.js` and update:
```javascript
autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'YOUR_GITHUB_USERNAME',    // Replace with your username
    repo: 'sniffler-releases',        // Replace with your repo name
    private: false
});
```

#### 2. **Update Package.json**
Edit the root `package.json` publish section:
```json
"publish": [
  {
    "provider": "github",
    "owner": "YOUR_USERNAME",         // Replace with your username
    "repo": "sniffler-releases"       // Replace with your repo name
  }
]
```

#### 3. **Update Website Downloads**
Edit `sniffler-website/js/downloads.js`:
```javascript
this.repoOwner = 'YOUR_USERNAME';      // Replace with your username
this.repoName = 'sniffler-releases';   // Replace with your repo name
```

## Release Process

### 1. **Create a Release**
```bash
# Commit your changes
git add .
git commit -m "Release v1.1.0"

# Create and push version tag
git tag v1.1.0
git push origin v1.1.0
```

### 2. **Automatic Build**
- GitHub Actions automatically builds for Windows, macOS, and Linux
- Publishes releases with auto-updater metadata
- Users get notified of the new version

### 3. **Update Delivery**
- Running Sniffler apps check for updates within 24 hours
- Users are prompted to download and install
- Process is seamless and user-friendly

## Technical Details

### Files Involved
- `apps/main/auto-updater.js` - Auto-updater implementation
- `apps/main/index.js` - Integration with main process
- `apps/main/preload.js` - Renderer process API
- `.github/workflows/build-and-release.yml` - GitHub Actions workflow
- `package.json` - Electron-builder and publish configuration

### Update Metadata
Electron-updater uses GitHub releases to:
- Check for new versions
- Download update files
- Verify file integrity
- Manage update process

### Supported Platforms
- **Windows**: NSIS installer with auto-updater support
- **macOS**: DMG with auto-updater support  
- **Linux**: AppImage with auto-updater support

## User Experience

### First-Time Setup
1. User downloads and installs Sniffler
2. App starts checking for updates automatically
3. No additional setup required

### Update Notification
```
┌─────────────────────────────────────┐
│ Update Available                    │
├─────────────────────────────────────┤
│ Sniffler 1.1.0 is available!       │
│                                     │
│ You are currently using version     │
│ 1.0.0.                             │
│                                     │
│ Would you like to download the      │
│ update now?                         │
├─────────────────────────────────────┤
│ [Download Now] [Later] [Background] │
└─────────────────────────────────────┘
```

### Download Progress
```
┌─────────────────────────────────────┐
│ Downloading Update...               │
├─────────────────────────────────────┤
│ ████████████████░░░░░░░░ 67%       │
│                                     │
│ 45.2 MB of 67.8 MB                 │
│ Speed: 2.1 MB/s                    │
└─────────────────────────────────────┘
```

### Install Prompt
```
┌─────────────────────────────────────┐
│ Update Ready to Install             │
├─────────────────────────────────────┤
│ Sniffler 1.1.0 has been downloaded │
│ and is ready to install.            │
│                                     │
│ The application will restart to     │
│ complete the installation.          │
├─────────────────────────────────────┤
│ [Install Now] [Install Later]       │
└─────────────────────────────────────┘
```

## Troubleshooting

### Updates Not Working
1. Check internet connection
2. Verify GitHub repository is accessible
3. Check app logs for error messages
4. Try manual update check

### Manual Update Check
Users can trigger manual checks via:
- Menu: Help → Check for Updates
- Settings: Updates section
- Developer tools: Auto-updater API

## Security

### Code Signing
For production releases, consider adding code signing:
- Windows: Authenticode signing
- macOS: Apple Developer signing
- Linux: GPG signing

### Update Verification
Electron-updater automatically:
- Verifies file checksums
- Validates signatures (when available)
- Ensures secure download process

## Benefits

### For Users
- ✅ Always have the latest features
- ✅ Automatic security updates
- ✅ Seamless update experience
- ✅ No manual download required

### For Developers  
- ✅ Easy deployment process
- ✅ Automatic user adoption
- ✅ Reduced support overhead
- ✅ Better user engagement

## Cost
- **GitHub Releases**: Free (unlimited bandwidth)
- **Auto-updater**: Free (built into Electron)
- **Total Cost**: $0

The auto-update system provides professional software update experience at zero cost!
