/**
 * Core test runner for map component refactor
 * Runs essential tests to verify the refactoring is working correctly
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Core test suites that must pass
const CORE_TEST_SUITES = [
  {
    name: 'Geometry Validation Tests',
    pattern: '__tests__/utils/geometryValidation.test.js',
    description: 'Tests geometry validation functionality'
  },
  {
    name: 'Geometry Operations Tests', 
    pattern: '__tests__/utils/geometryOperations.test.js',
    description: 'Tests geometry operations like union and difference'
  },
  {
    name: 'Fog Calculation Tests',
    pattern: '__tests__/utils/fogCalculation.test.js', 
    description: 'Tests fog calculation logic'
  },
  {
    name: 'Map Viewport Hook Tests',
    pattern: '__tests__/hooks/useMapViewport.test.js',
    description: 'Tests viewport management hook'
  }
];

/**
 * Run a single test suite
 */
async function runTestSuite(suite) {
  console.log(`\n🧪 Running ${suite.name}...`);
  console.log(`📝 ${suite.description}`);
  
  const startTime = Date.now();
  
  try {
    const command = `npx jest --testPathPatterns="${suite.pattern}" --verbose --forceExit --maxWorkers=1`;
    console.log(`🚀 Command: ${command}`);
    
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      maxBuffer: 5 * 1024 * 1024 // 5MB buffer
    });
    
    const executionTime = Date.now() - startTime;
    console.log(`✅ ${suite.name} completed in ${executionTime}ms`);
    
    return { success: true, executionTime, output };
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.log(`❌ ${suite.name} failed after ${executionTime}ms`);
    console.log(`💥 Error: ${error.message}`);
    
    return { success: false, executionTime, error: error.message, output: error.stdout || error.stderr };
  }
}

/**
 * Main test runner
 */
async function runCoreTests() {
  console.log('🚀 Running Core Map Refactor Tests');
  console.log('='.repeat(60));
  
  const overallStartTime = Date.now();
  const results = [];
  
  // Check if we're in the right directory
  if (!fs.existsSync('package.json')) {
    console.error('❌ Error: package.json not found. Please run from project root.');
    process.exit(1);
  }
  
  // Run each core test suite
  for (const suite of CORE_TEST_SUITES) {
    const result = await runTestSuite(suite);
    results.push({ ...suite, ...result });
    
    // Brief pause between suites
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const overallTime = Date.now() - overallStartTime;
  
  // Generate summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 CORE TEST RESULTS');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.length - passed;
  
  console.log(`\n📊 SUMMARY`);
  console.log(`Test Suites: ${passed}/${results.length} passed`);
  console.log(`Time: ${overallTime}ms`);
  
  console.log(`\n📋 DETAILED RESULTS`);
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name} (${result.executionTime}ms)`);
    if (!result.success) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  if (failed === 0) {
    console.log('\n🎉 All core tests passed! Map refactor is working correctly.');
    process.exit(0);
  } else {
    console.log(`\n💥 ${failed} test suite(s) failed. Please review the results above.`);
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Core Test Runner for Map Component Refactor');
  console.log('');
  console.log('Usage: node run-core-tests.js');
  console.log('');
  console.log('This runs the essential tests to verify the map refactor is working.');
  process.exit(0);
}

// Run the tests
runCoreTests().catch(error => {
  console.error('❌ Error running core tests:', error);
  process.exit(1);
});