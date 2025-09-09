# GitHub Releases Setup for Sniffler

This directory contains GitHub Actions workflows to automatically build and release your Sniffler app.

## How It Works

1. **Automatic Builds**: When you push a git tag (like `v1.0.0`), GitHub Actions will:

   - Build your app on Windows, macOS, and Linux
   - Create installers for each platform
   - Create a GitHub release with all the files

2. **Manual Builds**: You can also trigger builds manually from the GitHub Actions tab

## Setup Instructions

### 1. Enable GitHub Actions

- Go to your repository on GitHub
- Click on the "Actions" tab
- If prompted, enable GitHub Actions for your repository

### 2. Create a Release

To create your first release:

```bash
# Make sure your code is committed
git add .
git commit -m "Ready for v1.0.0 release"

# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0
```

### 3. Monitor the Build

- Go to the "Actions" tab on GitHub
- Watch the "Build and Release" workflow run
- It will take about 10-15 minutes to build for all platforms

### 4. Check Your Release

- Go to the "Releases" section of your repository
- Your new release will be created automatically with all the installers

## File Naming Convention

The workflow expects your `electron-builder` config (in `package.json`) to create files with these patterns:

- Windows: `*.exe` files
- macOS: `*.dmg` files
- Linux: `*.AppImage` or `*.deb` files

## Troubleshooting

### Build Fails

1. Check that your `package.json` scripts work locally:

   ```bash
   npm install
   npm run build
   npm run dist
   ```

2. Ensure your `electron-builder` config is correct

### No Releases Created

1. Make sure you pushed a tag that starts with `v`: `git push origin v1.0.0`
2. Check the Actions tab for error messages

### Files Missing from Release

1. Check that `npm run dist` creates files in the `dist/packages/` directory
2. Verify the file paths in the workflow match your build output

## Customization

### Change the Trigger

Edit `.github/workflows/build-and-release.yml` to change when builds trigger:

```yaml
on:
  push:
    branches: [main] # Build on every push to main
    tags: ["v*"] # Build on version tags
  pull_request: # Build on pull requests
```

### Add Code Signing

For production releases, you'll want to add code signing:

1. **Windows**: Add certificates to GitHub secrets
2. **macOS**: Add Apple Developer certificates
3. **Linux**: Usually not required

### Custom Release Notes

Edit the `body:` section in the workflow to customize release notes.

## Next Steps

1. **Test the workflow** by creating a test tag
2. **Update your website** to point to the new releases repository
3. **Set up automatic updates** in your Electron app (optional)

## Security Notes

- The workflow uses `GITHUB_TOKEN` which is automatically provided
- No additional secrets are required for basic functionality
- For code signing, you'll need to add certificate secrets
