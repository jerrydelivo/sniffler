// Simple test to verify auto-updater integration
const SnifflerAutoUpdater = require('./apps/main/auto-updater');

async function testAutoUpdater() {
    console.log('🧪 Testing Sniffler Auto-Updater...');
    
    // Mock mainWindow object
    const mockMainWindow = {
        webContents: {
            send: (event, data) => {
                console.log(`📡 Event sent to renderer: ${event}`, data);
            }
        }
    };
    
    try {
        // Initialize auto-updater
        const autoUpdater = new SnifflerAutoUpdater(mockMainWindow);
        console.log('✅ Auto-updater initialized successfully');
        
        // Test status method
        const status = autoUpdater.getStatus();
        console.log('📊 Current status:', status);
        
        // Test settings update
        autoUpdater.updateSettings({
            autoCheck: false, // Disable for testing
            checkInterval: 1, // 1 hour
            autoDownload: false,
            autoInstall: false
        });
        console.log('⚙️ Settings updated successfully');
        
        console.log('✅ All auto-updater tests passed!');
        
    } catch (error) {
        console.error('❌ Auto-updater test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run test if called directly
if (require.main === module) {
    testAutoUpdater();
}

module.exports = testAutoUpdater;
