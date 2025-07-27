#!/usr/bin/env node

/**
 * Database inspection utility for fog of war persistence testing
 * Helps verify data integrity and debug persistence issues
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Fog of War Database Inspector');
console.log('=================================\n');

const commands = {
  'list-devices': {
    cmd: 'adb devices',
    description: 'List connected Android devices/emulators'
  },
  'app-info': {
    cmd: 'adb shell pm list packages | grep cartographer',
    description: 'Check if Cartographer app is installed'
  },
  'database-location': {
    cmd: 'adb shell run-as com.deabound.Cartographer find /data/data/com.deabound.Cartographer -name "*.db" 2>/dev/null || echo "Database not found or app not installed"',
    description: 'Find SQLite database location'
  },
  'database-tables': {
    cmd: 'adb shell run-as com.deabound.Cartographer sqlite3 /data/data/com.deabound.Cartographer/databases/locations.db ".tables"',
    description: 'List database tables'
  },
  'locations-count': {
    cmd: 'adb shell run-as com.deabound.Cartographer sqlite3 /data/data/com.deabound.Cartographer/databases/locations.db "SELECT COUNT(*) FROM locations;"',
    description: 'Count location records'
  },
  'revealed-areas-count': {
    cmd: 'adb shell run-as com.deabound.Cartographer sqlite3 /data/data/com.deabound.Cartographer/databases/locations.db "SELECT COUNT(*) FROM revealed_areas;"',
    description: 'Count revealed area records'
  },
  'recent-locations': {
    cmd: 'adb shell run-as com.deabound.Cartographer sqlite3 /data/data/com.deabound.Cartographer/databases/locations.db "SELECT latitude, longitude, datetime(timestamp/1000, \'unixepoch\') as time FROM locations ORDER BY timestamp DESC LIMIT 10;"',
    description: 'Show 10 most recent location records'
  },
  'revealed-areas-sample': {
    cmd: 'adb shell run-as com.deabound.Cartographer sqlite3 /data/data/com.deabound.Cartographer/databases/locations.db "SELECT id, substr(geojson, 1, 100) || \'...\' as geojson_preview FROM revealed_areas LIMIT 5;"',
    description: 'Show sample revealed area records'
  },
  'database-size': {
    cmd: 'adb shell run-as com.deabound.Cartographer ls -lh /data/data/com.deabound.Cartographer/databases/locations.db',
    description: 'Check database file size'
  },
  'clear-database': {
    cmd: 'adb shell run-as com.deabound.Cartographer sqlite3 /data/data/com.deabound.Cartographer/databases/locations.db "DELETE FROM locations; DELETE FROM revealed_areas; VACUUM;"',
    description: '⚠️  DANGER: Clear all data from database'
  }
};

function runCommand(commandKey) {
  const command = commands[commandKey];
  if (!command) {
    console.log(`❌ Unknown command: ${commandKey}`);
    return;
  }

  console.log(`🔧 ${command.description}`);
  console.log(`   Command: ${command.cmd}\n`);

  try {
    const output = execSync(command.cmd, { encoding: 'utf8', timeout: 10000 });
    console.log(`✅ Result:`);
    console.log(output);
  } catch (error) {
    console.log(`❌ Error:`);
    console.log(error.message);
  }
  console.log('─'.repeat(50) + '\n');
}

function showMenu() {
  console.log('📋 Available Commands:');
  console.log('======================\n');
  
  Object.keys(commands).forEach((key, index) => {
    const command = commands[key];
    const warning = key === 'clear-database' ? ' ⚠️  DANGER' : '';
    console.log(`${index + 1}. ${key}${warning}`);
    console.log(`   ${command.description}\n`);
  });
}

function validateGeometry(geojsonString) {
  try {
    const geojson = JSON.parse(geojsonString);
    
    const checks = {
      hasType: geojson.type === 'Feature',
      hasGeometry: !!geojson.geometry,
      validGeometryType: geojson.geometry?.type === 'Polygon' || geojson.geometry?.type === 'MultiPolygon',
      hasCoordinates: !!geojson.geometry?.coordinates,
      isArray: Array.isArray(geojson.geometry?.coordinates),
      notEmpty: geojson.geometry?.coordinates?.length > 0
    };

    let isValid = Object.values(checks).every(check => check);
    
    // Additional coordinate validation for Polygon
    if (isValid && geojson.geometry.type === 'Polygon') {
      const ring = geojson.geometry.coordinates[0];
      if (ring && ring.length >= 4) {
        const first = ring[0];
        const last = ring[ring.length - 1];
        checks.isClosed = first[0] === last[0] && first[1] === last[1];
        checks.validCoordinates = ring.every(coord => 
          Array.isArray(coord) && 
          coord.length === 2 && 
          typeof coord[0] === 'number' && 
          typeof coord[1] === 'number' &&
          coord[0] >= -180 && coord[0] <= 180 &&
          coord[1] >= -90 && coord[1] <= 90
        );
        isValid = checks.isClosed && checks.validCoordinates;
      } else {
        checks.sufficientPoints = false;
        isValid = false;
      }
    }

    return { isValid, checks, geometry: geojson.geometry };
  } catch (error) {
    return { isValid: false, error: error.message };
  }
}

function inspectRevealedAreas() {
  console.log('🔍 Inspecting Revealed Areas Geometry');
  console.log('=====================================\n');

  try {
    const cmd = 'adb shell run-as com.deabound.Cartographer sqlite3 /data/data/com.deabound.Cartographer/databases/locations.db "SELECT id, geojson FROM revealed_areas;"';
    const output = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
    
    if (!output.trim()) {
      console.log('📭 No revealed areas found in database\n');
      return;
    }

    const lines = output.trim().split('\n');
    console.log(`📊 Found ${lines.length} revealed area(s)\n`);

    lines.forEach((line, index) => {
      const parts = line.split('|');
      if (parts.length >= 2) {
        const id = parts[0];
        const geojsonString = parts.slice(1).join('|');
        
        console.log(`🔸 Revealed Area ${id}:`);
        const validation = validateGeometry(geojsonString);
        
        if (validation.isValid) {
          console.log('   ✅ Valid geometry');
          if (validation.geometry) {
            console.log(`   📐 Type: ${validation.geometry.type}`);
            if (validation.geometry.type === 'Polygon') {
              const ringCount = validation.geometry.coordinates.length;
              const vertexCount = validation.geometry.coordinates[0]?.length || 0;
              console.log(`   📊 Rings: ${ringCount}, Vertices: ${vertexCount}`);
            }
          }
        } else {
          console.log('   ❌ Invalid geometry');
          if (validation.error) {
            console.log(`   🐛 Error: ${validation.error}`);
          }
          if (validation.checks) {
            Object.entries(validation.checks).forEach(([check, passed]) => {
              const status = passed ? '✅' : '❌';
              console.log(`   ${status} ${check}`);
            });
          }
        }
        console.log('');
      }
    });
  } catch (error) {
    console.log(`❌ Error inspecting revealed areas: ${error.message}\n`);
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  showMenu();
  console.log('💡 Usage Examples:');
  console.log('==================\n');
  console.log('node scripts/inspect-database.js list-devices');
  console.log('node scripts/inspect-database.js database-tables');
  console.log('node scripts/inspect-database.js revealed-areas-count');
  console.log('node scripts/inspect-database.js inspect-geometry');
  console.log('node scripts/inspect-database.js all  # Run all safe commands\n');
  
  console.log('⚠️  Prerequisites:');
  console.log('==================\n');
  console.log('1. Android device/emulator connected via ADB');
  console.log('2. Cartographer app installed and run at least once');
  console.log('3. ADB tools available in PATH\n');
  
} else if (args[0] === 'all') {
  console.log('🚀 Running all safe database inspection commands...\n');
  const safeCommands = ['list-devices', 'app-info', 'database-location', 'database-tables', 
                       'locations-count', 'revealed-areas-count', 'database-size'];
  
  safeCommands.forEach(cmd => runCommand(cmd));
  inspectRevealedAreas();
  
} else if (args[0] === 'inspect-geometry') {
  inspectRevealedAreas();
  
} else if (commands[args[0]]) {
  runCommand(args[0]);
  
} else {
  console.log(`❌ Unknown command: ${args[0]}`);
  console.log('Run without arguments to see available commands.\n');
}