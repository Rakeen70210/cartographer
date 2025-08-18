#!/usr/bin/env node

/**
 * Android Emulator Fog of War Testing Script
 * 
 * This script helps validate fog calculation fixes by:
 * 1. Checking if Android emulator is running
 * 2. Starting the Expo development server
 * 3. Opening the app on Android
 * 4. Providing GPS simulation instructions
 * 5. Running automated tests to validate fog functionality
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  // GPS coordinates for testing (San Francisco area)
  testLocations: [
    { lat: 37.7749, lng: -122.4194, name: 'San Francisco Downtown' },
    { lat: 37.7849, lng: -122.4094, name: 'North Beach' },
    { lat: 37.7649, lng: -122.4294, name: 'Mission District' },
    { lat: 37.7949, lng: -122.4394, name: 'Pacific Heights' }
  ],
  
  // Expected performance thresholds
  performance: {
    maxFogCalculationTime: 100, // ms
    maxViewportUpdateTime: 300, // ms
    debounceDelay: 300 // ms
  },
  
  // Test scenarios
  scenarios: [
    'App starts with no revealed areas',
    'Fog displays correctly when no GPS locations exist',
    'Fog updates when simulated GPS location changes',
    'Viewport changes trigger fog recalculation',
    'Performance remains good with multiple revealed areas',
    'Logging is properly throttled and readable'
  ]
};

/**
 * Colors for console output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Utility functions for colored console output
 */
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  step: (msg) => console.log(`${colors.cyan}🔧${colors.reset} ${msg}`),
  test: (msg) => console.log(`${colors.magenta}🧪${colors.reset} ${msg}`)
};

/**
 * Check if Android emulator is running
 */
function checkAndroidEmulator() {
  log.step('Checking Android emulator status...');
  
  try {
    const devices = execSync('adb devices', { encoding: 'utf8' });
    const lines = devices.split('\n').filter(line => line.includes('device') && !line.includes('List of devices'));
    
    if (lines.length === 0) {
      log.error('No Android devices found. Please start an Android emulator.');
      log.info('To start an emulator:');
      log.info('1. Open Android Studio');
      log.info('2. Go to Tools > AVD Manager');
      log.info('3. Start an existing AVD or create a new one');
      return false;
    }
    
    log.success(`Found ${lines.length} Android device(s):`);
    lines.forEach(line => {
      const deviceId = line.split('\t')[0];
      log.info(`  - ${deviceId}`);
    });
    
    return true;
  } catch (error) {
    log.error('Failed to check Android devices. Make sure Android SDK is installed.');
    log.error(error.message);
    return false;
  }
}

/**
 * Run unit tests to validate fog calculation functions
 */
async function runFogTests() {
  log.step('Running fog calculation unit tests...');
  
  try {
    const testOutput = execSync('npm test -- --testPathPatterns="fog" --passWithNoTests', { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    // Parse test results
    const lines = testOutput.split('\n');
    const summaryLine = lines.find(line => line.includes('Tests:'));
    
    if (summaryLine && summaryLine.includes('passed')) {
      log.success('Unit tests passed');
      log.info(summaryLine.trim());
      return true;
    } else {
      log.warning('Some unit tests may have issues');
      log.info('Check test output for details');
      return false;
    }
  } catch (error) {
    log.error('Unit tests failed');
    log.error('This may indicate issues with fog calculation functions');
    return false;
  }
}

/**
 * Start the Expo development server
 */
function startExpoServer() {
  log.step('Starting Expo development server...');
  
  return new Promise((resolve, reject) => {
    const expoProcess = spawn('npx', ['expo', 'start', '--dev-client'], {
      stdio: 'pipe'
    });
    
    let serverStarted = false;
    
    expoProcess.stdout.on('data', (data) => {
      const output = data.toString();
      
      if (output.includes('Metro waiting on') && !serverStarted) {
        serverStarted = true;
        log.success('Expo development server started');
        resolve(expoProcess);
      }
      
      // Log important messages
      if (output.includes('ERROR') || output.includes('WARN')) {
        log.warning('Server message: ' + output.trim());
      }
    });
    
    expoProcess.stderr.on('data', (data) => {
      const error = data.toString();
      if (error.includes('ERROR')) {
        log.error('Server error: ' + error.trim());
      }
    });
    
    expoProcess.on('error', (error) => {
      log.error('Failed to start Expo server: ' + error.message);
      reject(error);
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      if (!serverStarted) {
        log.error('Expo server failed to start within 30 seconds');
        expoProcess.kill();
        reject(new Error('Server startup timeout'));
      }
    }, 30000);
  });
}

/**
 * Open the app on Android
 */
async function openAppOnAndroid() {
  log.step('Opening app on Android emulator...');
  
  try {
    // Use expo run:android to build and install the app
    execSync('npx expo run:android --no-bundler', { 
      stdio: 'inherit',
      timeout: 120000 // 2 minutes timeout
    });
    
    log.success('App opened on Android emulator');
    return true;
  } catch (error) {
    log.error('Failed to open app on Android');
    log.error(error.message);
    return false;
  }
}

/**
 * Provide GPS simulation instructions
 */
function provideGPSInstructions() {
  log.step('GPS Simulation Instructions');
  console.log('\n' + '='.repeat(60));
  console.log('📍 HOW TO SIMULATE GPS LOCATIONS IN ANDROID EMULATOR');
  console.log('='.repeat(60));
  
  console.log('\n1. Open Android Emulator Extended Controls:');
  console.log('   - Click the "..." button in the emulator toolbar');
  console.log('   - Or press Ctrl+Shift+P (Cmd+Shift+P on Mac)');
  
  console.log('\n2. Navigate to Location:');
  console.log('   - Click "Location" in the left sidebar');
  
  console.log('\n3. Test with these coordinates:');
  TEST_CONFIG.testLocations.forEach((location, index) => {
    console.log(`   ${index + 1}. ${location.name}:`);
    console.log(`      Latitude: ${location.lat}`);
    console.log(`      Longitude: ${location.lng}`);
  });
  
  console.log('\n4. Testing Steps:');
  console.log('   a) Start with first location and click "Send"');
  console.log('   b) Observe fog display (should show full fog initially)');
  console.log('   c) Move to second location and click "Send"');
  console.log('   d) Check if revealed area appears around first location');
  console.log('   e) Pan the map to test viewport-based fog updates');
  console.log('   f) Zoom in/out to test different zoom levels');
  
  console.log('\n5. What to Look For:');
  console.log('   ✅ App starts without "All fog calculations failed" errors');
  console.log('   ✅ Fog displays as dark overlay over unexplored areas');
  console.log('   ✅ Revealed areas show clear map without fog');
  console.log('   ✅ Smooth performance during map interactions');
  console.log('   ✅ Reasonable logging output (not excessive)');
  
  console.log('\n6. Performance Expectations:');
  console.log(`   - Fog calculation: < ${TEST_CONFIG.performance.maxFogCalculationTime}ms`);
  console.log(`   - Viewport updates: < ${TEST_CONFIG.performance.maxViewportUpdateTime}ms`);
  console.log(`   - Debounce delay: ${TEST_CONFIG.performance.debounceDelay}ms`);
  
  console.log('\n' + '='.repeat(60));
}

/**
 * Provide debugging instructions
 */
function provideDebuggingInstructions() {
  log.step('Debugging Instructions');
  console.log('\n' + '='.repeat(60));
  console.log('🐛 DEBUGGING FOG CALCULATION ISSUES');
  console.log('='.repeat(60));
  
  console.log('\n1. Check Metro Bundler Logs:');
  console.log('   - Look for fog-related error messages');
  console.log('   - Check for geometry operation failures');
  console.log('   - Monitor performance warnings');
  
  console.log('\n2. Common Issues to Check:');
  console.log('   ❌ "All fog calculations failed" - Check geometry validation');
  console.log('   ❌ Infinite logging loops - Check throttling implementation');
  console.log('   ❌ Poor performance - Check viewport optimization');
  console.log('   ❌ No fog display - Check fallback strategies');
  
  console.log('\n3. Debug Commands:');
  console.log('   - Press "j" in Metro to open debugger');
  console.log('   - Press "r" to reload the app');
  console.log('   - Press "m" to toggle developer menu');
  
  console.log('\n4. Log Analysis:');
  console.log('   - Look for throttled debug messages (should not spam)');
  console.log('   - Check for proper error handling');
  console.log('   - Verify viewport bounds are reasonable');
  
  console.log('\n' + '='.repeat(60));
}

/**
 * Main test execution function
 */
async function runAndroidFogTests() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 ANDROID EMULATOR FOG OF WAR TESTING');
  console.log('='.repeat(80));
  
  // Step 1: Check Android emulator
  if (!checkAndroidEmulator()) {
    process.exit(1);
  }
  
  // Step 2: Run unit tests first
  log.test('Running preliminary unit tests...');
  const testsPass = await runFogTests();
  if (!testsPass) {
    log.warning('Unit tests have issues, but continuing with emulator testing...');
  }
  
  // Step 3: Start Expo server
  let expoProcess;
  try {
    expoProcess = await startExpoServer();
  } catch (error) {
    log.error('Failed to start Expo server');
    process.exit(1);
  }
  
  // Step 4: Open app on Android
  const appOpened = await openAppOnAndroid();
  if (!appOpened) {
    log.error('Failed to open app on Android');
    if (expoProcess) expoProcess.kill();
    process.exit(1);
  }
  
  // Step 5: Provide testing instructions
  provideGPSInstructions();
  provideDebuggingInstructions();
  
  // Step 6: Wait for user testing
  console.log('\n' + '='.repeat(60));
  console.log('🎯 MANUAL TESTING PHASE');
  console.log('='.repeat(60));
  console.log('\nThe app is now running on the Android emulator.');
  console.log('Please follow the GPS simulation instructions above.');
  console.log('\nPress Ctrl+C when you have completed testing.');
  
  // Keep the process running
  process.on('SIGINT', () => {
    log.step('Cleaning up...');
    if (expoProcess) {
      expoProcess.kill();
    }
    log.success('Testing session completed');
    process.exit(0);
  });
  
  // Keep alive
  setInterval(() => {
    // Just keep the process running
  }, 1000);
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Android Emulator Fog of War Testing Script');
  console.log('');
  console.log('Usage: node test-fog-android.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h     Show this help message');
  console.log('  --tests-only   Run only unit tests, skip emulator');
  console.log('');
  console.log('This script will:');
  console.log('1. Check if Android emulator is running');
  console.log('2. Run fog calculation unit tests');
  console.log('3. Start Expo development server');
  console.log('4. Open the app on Android emulator');
  console.log('5. Provide GPS simulation instructions');
  process.exit(0);
}

if (process.argv.includes('--tests-only')) {
  runFogTests().then(success => {
    process.exit(success ? 0 : 1);
  });
} else {
  runAndroidFogTests().catch(error => {
    log.error('Testing failed: ' + error.message);
    process.exit(1);
  });
}