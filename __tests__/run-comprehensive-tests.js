/**
 * Comprehensive test runner for map component refactor
 * Runs all test suites with performance monitoring and reporting
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test suite configuration (consolidated from multiple test runners)
const TEST_SUITES = {
  // Core functionality tests (from run-core-tests.js) - optimized timeouts
  core: {
    name: 'Core Tests',
    pattern: '__tests__/{fogCalculation,geometryValidation,distanceCalculator,worldExplorationCalculator}.test.js',
    timeout: 20000,          // Reduced for faster execution (requirement 5.1)
    description: 'Essential functionality tests that must pass'
  },
  
  // Fog validation tests (from run-fog-validation.js) - optimized timeouts
  fogValidation: {
    name: 'Fog Validation Tests',
    pattern: '__tests__/{AdvancedFogOverlay,map.integration.simple,database.persistence.simple,location-tracking.integration.simple}.test.js',
    timeout: 30000,          // Reduced for better performance (requirement 5.1)
    description: 'Complete fog workflow validation from GPS to visual rendering'
  },
  
  integration: {
    name: 'Integration Tests',
    pattern: '__tests__/integration/**/*.test.js',
    timeout: 30000,          // Reduced for better performance (requirement 5.1)
    description: 'Tests interaction between refactored components'
  },
  performance: {
    name: 'Performance Tests',
    pattern: '__tests__/performance/**/*.test.js',
    timeout: 30000,          // Significantly reduced (requirement 5.1)
    description: 'Benchmarks geometry operations and fog calculations'
  },
  errorScenarios: {
    name: 'Error Scenario Tests',
    pattern: '__tests__/error-scenarios/**/*.test.js',
    timeout: 25000,          // Reduced for better performance (requirement 5.1)
    description: 'Tests error handling and fallback strategies'
  },
  memory: {
    name: 'Memory Tests',
    pattern: '__tests__/memory/**/*.test.js',
    timeout: 30000,          // Significantly reduced (requirement 5.1)
    description: 'Monitors memory usage and component lifecycle'
  },
  regression: {
    name: 'Regression Tests',
    pattern: '__tests__/regression/**/*.test.js',
    timeout: 25000,          // Reduced for better performance (requirement 5.1)
    description: 'Ensures no behavioral changes after refactoring'
  }
};

// Test execution options
const TEST_OPTIONS = {
  verbose: true,
  coverage: true,
  detectOpenHandles: true,
  forceExit: true,
  maxWorkers: 1 // Single worker for memory tests
};

// Results tracking
let testResults = {
  suites: {},
  summary: {
    totalSuites: 0,
    passedSuites: 0,
    failedSuites: 0,
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    totalTime: 0,
    coverage: null
  }
};

/**
 * Formats time duration in human readable format
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Runs a single test suite
 */
async function runTestSuite(suiteKey, suite) {
  console.log(`\n🧪 Running ${suite.name}...`);
  console.log(`📝 ${suite.description}`);
  console.log(`🎯 Pattern: ${suite.pattern}`);
  
  const startTime = Date.now();
  
  try {
    // Build Jest command
    const jestArgs = [
      '--testPathPatterns', suite.pattern,
      '--testTimeout', suite.timeout.toString(),
      '--verbose',
      '--detectOpenHandles',
      '--forceExit',
      '--maxWorkers=1'
    ];
    
    // Add coverage for performance tests
    if (suiteKey === 'performance' || suiteKey === 'integration') {
      jestArgs.push('--coverage', '--coverageDirectory', `coverage/${suiteKey}`);
    }
    
    const command = `npx jest ${jestArgs.join(' ')}`;
    console.log(`🚀 Command: ${command}`);
    
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    const executionTime = Date.now() - startTime;
    
    // Parse Jest output for test counts
    const testResults = parseJestOutput(output);
    
    testResults.suites[suiteKey] = {
      name: suite.name,
      status: 'passed',
      executionTime,
      tests: testResults.tests || 0,
      passed: testResults.passed || 0,
      failed: testResults.failed || 0,
      output: output.split('\n').slice(-20).join('\n') // Last 20 lines
    };
    
    console.log(`✅ ${suite.name} completed in ${formatDuration(executionTime)}`);
    console.log(`📊 Tests: ${testResults.passed}/${testResults.tests} passed`);
    
    return true;
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    testResults.suites[suiteKey] = {
      name: suite.name,
      status: 'failed',
      executionTime,
      error: error.message,
      output: error.stdout || error.stderr || 'No output available'
    };
    
    console.log(`❌ ${suite.name} failed after ${formatDuration(executionTime)}`);
    console.log(`💥 Error: ${error.message}`);
    
    return false;
  }
}

/**
 * Parses Jest output to extract test statistics
 */
function parseJestOutput(output) {
  const lines = output.split('\n');
  let tests = 0, passed = 0, failed = 0;
  
  // Look for Jest summary lines
  for (const line of lines) {
    if (line.includes('Tests:')) {
      const match = line.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
      if (match) {
        failed = parseInt(match[1]);
        passed = parseInt(match[2]);
        tests = parseInt(match[3]);
        break;
      }
      
      const passedMatch = line.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
      if (passedMatch) {
        passed = parseInt(passedMatch[1]);
        tests = parseInt(passedMatch[2]);
        failed = tests - passed;
        break;
      }
    }
  }
  
  return { tests, passed, failed };
}

/**
 * Generates a comprehensive test report
 */
function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 COMPREHENSIVE TEST REPORT');
  console.log('='.repeat(80));
  
  // Calculate summary
  testResults.summary.totalSuites = Object.keys(testResults.suites).length;
  testResults.summary.passedSuites = Object.values(testResults.suites).filter(s => s.status === 'passed').length;
  testResults.summary.failedSuites = testResults.summary.totalSuites - testResults.summary.passedSuites;
  
  testResults.summary.totalTests = Object.values(testResults.suites).reduce((sum, s) => sum + (s.tests || 0), 0);
  testResults.summary.passedTests = Object.values(testResults.suites).reduce((sum, s) => sum + (s.passed || 0), 0);
  testResults.summary.failedTests = testResults.summary.totalTests - testResults.summary.passedTests;
  
  testResults.summary.totalTime = Object.values(testResults.suites).reduce((sum, s) => sum + s.executionTime, 0);
  
  // Print summary
  console.log('\n📊 SUMMARY');
  console.log(`Test Suites: ${testResults.summary.passedSuites}/${testResults.summary.totalSuites} passed`);
  console.log(`Tests:       ${testResults.summary.passedTests}/${testResults.summary.totalTests} passed`);
  console.log(`Time:        ${formatDuration(testResults.summary.totalTime)}`);
  
  // Print detailed results
  console.log('\n📋 DETAILED RESULTS');
  Object.entries(testResults.suites).forEach(([key, suite]) => {
    const status = suite.status === 'passed' ? '✅' : '❌';
    const time = formatDuration(suite.executionTime);
    
    console.log(`${status} ${suite.name} (${time})`);
    
    if (suite.tests) {
      console.log(`   Tests: ${suite.passed}/${suite.tests} passed`);
    }
    
    if (suite.status === 'failed') {
      console.log(`   Error: ${suite.error}`);
    }
  });
  
  // Performance insights
  console.log('\n⚡ PERFORMANCE INSIGHTS');
  const sortedSuites = Object.entries(testResults.suites)
    .sort(([,a], [,b]) => b.executionTime - a.executionTime);
  
  sortedSuites.forEach(([key, suite], index) => {
    const time = formatDuration(suite.executionTime);
    const percentage = ((suite.executionTime / testResults.summary.totalTime) * 100).toFixed(1);
    console.log(`${index + 1}. ${suite.name}: ${time} (${percentage}%)`);
  });
  
  // Save detailed report
  const reportPath = path.join(__dirname, '..', 'test-results-comprehensive.json');
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\n💾 Detailed report saved to: ${reportPath}`);
  
  return testResults.summary.failedSuites === 0;
}

/**
 * Main test runner function
 */
async function runComprehensiveTests() {
  console.log('🚀 Starting Comprehensive Map Refactor Tests');
  console.log('='.repeat(80));
  
  const overallStartTime = Date.now();
  
  // Check if we're in the right directory
  if (!fs.existsSync('package.json')) {
    console.error('❌ Error: package.json not found. Please run from project root.');
    process.exit(1);
  }
  
  // Check if Jest is available
  try {
    execSync('npx jest --version', { stdio: 'pipe' });
  } catch (error) {
    console.error('❌ Error: Jest not found. Please install dependencies first.');
    process.exit(1);
  }
  
  // Run each test suite
  let allPassed = true;
  
  for (const [suiteKey, suite] of Object.entries(TEST_SUITES)) {
    const passed = await runTestSuite(suiteKey, suite);
    if (!passed) {
      allPassed = false;
    }
    
    // Brief pause between suites
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const overallTime = Date.now() - overallStartTime;
  console.log(`\n⏱️  Total execution time: ${formatDuration(overallTime)}`);
  
  // Generate comprehensive report
  const success = generateReport();
  
  if (success) {
    console.log('\n🎉 All tests passed! Map refactor is working correctly.');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed. Please review the results above.');
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Comprehensive Test Runner for Map Component Refactor');
  console.log('');
  console.log('Usage: node run-comprehensive-tests.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h     Show this help message');
  console.log('  --suite <name> Run only specific test suite');
  console.log('');
  console.log('Available test suites:');
  Object.entries(TEST_SUITES).forEach(([key, suite]) => {
    console.log(`  ${key.padEnd(15)} ${suite.description}`);
  });
  process.exit(0);
}

// Handle single suite execution
const suiteArg = args.indexOf('--suite');
if (suiteArg !== -1 && args[suiteArg + 1]) {
  const suiteName = args[suiteArg + 1];
  if (TEST_SUITES[suiteName]) {
    console.log(`🎯 Running single test suite: ${TEST_SUITES[suiteName].name}`);
    runTestSuite(suiteName, TEST_SUITES[suiteName])
      .then(success => process.exit(success ? 0 : 1))
      .catch(error => {
        console.error('❌ Error running test suite:', error);
        process.exit(1);
      });
  } else {
    console.error(`❌ Unknown test suite: ${suiteName}`);
    console.log('Available suites:', Object.keys(TEST_SUITES).join(', '));
    process.exit(1);
  }
} else {
  // Run all tests
  runComprehensiveTests().catch(error => {
    console.error('❌ Error running comprehensive tests:', error);
    process.exit(1);
  });
}