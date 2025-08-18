#!/usr/bin/env node

/**
 * Comprehensive Fog Functionality Validation Test Runner
 * 
 * This script runs all end-to-end validation tests for the fog of war system
 * and generates a detailed report of the test results.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(title) {
  const border = '='.repeat(60);
  console.log(colorize(border, 'cyan'));
  console.log(colorize(`  ${title}`, 'bright'));
  console.log(colorize(border, 'cyan'));
}

function printSection(title) {
  console.log(colorize(`\n📋 ${title}`, 'blue'));
  console.log(colorize('-'.repeat(40), 'blue'));
}

function printSuccess(message) {
  console.log(colorize(`✅ ${message}`, 'green'));
}

function printError(message) {
  console.log(colorize(`❌ ${message}`, 'red'));
}

function printWarning(message) {
  console.log(colorize(`⚠️  ${message}`, 'yellow'));
}

function printInfo(message) {
  console.log(colorize(`ℹ️  ${message}`, 'cyan'));
}

// Test suites to run
const testSuites = [
  {
    name: 'End-to-End Fog Validation',
    file: '__tests__/fog-end-to-end.validation.test.js',
    description: 'Complete fog workflow from GPS to visual rendering',
    requirements: ['1.1', '1.2', '1.3', '1.4', '2.1', '2.2', '2.3', '2.4', '3.1', '3.2', '3.3'],
  },
  {
    name: 'Fog Calculation Core',
    file: '__tests__/fogCalculation.test.js',
    description: 'Core fog calculation functionality',
    requirements: ['1.1', '1.2', '5.1', '5.2'],
  },
  {
    name: 'Spatial Fog Integration',
    file: '__tests__/integration/spatial-fog-integration.test.js',
    description: 'Spatial indexing and performance optimization',
    requirements: ['4.4', '1.1'],
  },
  {
    name: 'Fog Cache Integration',
    file: '__tests__/integration/fog-cache-integration.test.js',
    description: 'Fog caching and performance optimization',
    requirements: ['4.4'],
  },
  {
    name: 'Advanced Fog Overlay',
    file: '__tests__/AdvancedFogOverlay.test.js',
    description: 'Advanced fog visualization features',
    requirements: ['3.1', '3.2', '3.3'],
  },
  {
    name: 'Map Integration',
    file: '__tests__/map.integration.simple.test.js',
    description: 'Map component integration with fog system',
    requirements: ['4.1', '4.2', '4.3'],
  },
  {
    name: 'Database Persistence',
    file: '__tests__/database.persistence.simple.test.js',
    description: 'Revealed areas persistence across app restarts',
    requirements: ['2.1', '2.2', '2.3', '2.4'],
  },
  {
    name: 'Location Tracking Integration',
    file: '__tests__/location-tracking.integration.simple.test.js',
    description: 'GPS location tracking and fog updates',
    requirements: ['1.1', '1.4', '4.1'],
  },
];

// Performance benchmarks
const performanceBenchmarks = [
  {
    name: 'Fog Calculation Performance',
    file: '__tests__/statistics.performance.simple.test.js',
    description: 'Performance benchmarks for fog calculations',
    requirements: ['4.4'],
  },
  {
    name: 'Geometry Operations Performance',
    file: '__tests__/performance/geometry-operations.performance.test.js',
    description: 'Performance benchmarks for geometry operations',
    requirements: ['4.4', '5.1'],
  },
];

// Regression tests
const regressionTests = [
  {
    name: 'Behavioral Consistency',
    file: '__tests__/regression/behavioral-consistency.test.js',
    description: 'Ensures fog behavior remains consistent across updates',
    requirements: ['6.1', '6.2', '7.1', '7.2'],
  },
];

async function runTestSuite(suite) {
  printInfo(`Running: ${suite.name}`);
  printInfo(`File: ${suite.file}`);
  printInfo(`Requirements: ${suite.requirements.join(', ')}`);
  
  try {
    // Check if test file exists
    if (!fs.existsSync(suite.file)) {
      printWarning(`Test file not found: ${suite.file}`);
      return { success: false, skipped: true, error: 'File not found' };
    }

    // Run the test
    const startTime = Date.now();
    const result = execSync(`npm test -- ${suite.file} --verbose --no-coverage`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    const duration = Date.now() - startTime;

    printSuccess(`Completed in ${duration}ms`);
    return { success: true, duration, output: result };
  } catch (error) {
    printError(`Failed: ${error.message}`);
    return { success: false, error: error.message, output: error.stdout };
  }
}

async function generateReport(results) {
  const reportPath = path.join(__dirname, '..', 'fog-validation-report.json');
  const timestamp = new Date().toISOString();
  
  const report = {
    timestamp,
    summary: {
      totalTests: results.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success && !r.skipped).length,
      skipped: results.filter(r => r.skipped).length,
    },
    results: results.map(result => ({
      name: result.suite.name,
      file: result.suite.file,
      requirements: result.suite.requirements,
      success: result.success,
      skipped: result.skipped || false,
      duration: result.duration || 0,
      error: result.error || null,
    })),
    requirements: {
      coverage: calculateRequirementsCoverage(results),
    },
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  printInfo(`Report saved to: ${reportPath}`);
  
  return report;
}

function calculateRequirementsCoverage(results) {
  const allRequirements = new Set();
  const passedRequirements = new Set();
  
  results.forEach(result => {
    result.suite.requirements.forEach(req => {
      allRequirements.add(req);
      if (result.success) {
        passedRequirements.add(req);
      }
    });
  });
  
  return {
    total: allRequirements.size,
    passed: passedRequirements.size,
    coverage: (passedRequirements.size / allRequirements.size) * 100,
    details: Array.from(allRequirements).map(req => ({
      requirement: req,
      passed: passedRequirements.has(req),
    })),
  };
}

function printSummary(report) {
  printSection('Test Summary');
  
  const { summary, requirements } = report;
  
  console.log(`Total Tests: ${summary.totalTests}`);
  printSuccess(`Passed: ${summary.passed}`);
  if (summary.failed > 0) {
    printError(`Failed: ${summary.failed}`);
  }
  if (summary.skipped > 0) {
    printWarning(`Skipped: ${summary.skipped}`);
  }
  
  printSection('Requirements Coverage');
  console.log(`Total Requirements: ${requirements.coverage.total}`);
  console.log(`Covered Requirements: ${requirements.coverage.passed}`);
  console.log(`Coverage: ${requirements.coverage.coverage.toFixed(1)}%`);
  
  // Show failed requirements
  const failedRequirements = requirements.coverage.details
    .filter(req => !req.passed)
    .map(req => req.requirement);
  
  if (failedRequirements.length > 0) {
    printSection('Failed Requirements');
    failedRequirements.forEach(req => {
      printError(`Requirement ${req} not fully validated`);
    });
  }
}

async function main() {
  printHeader('FOG OF WAR FUNCTIONALITY VALIDATION');
  
  printInfo('This comprehensive test suite validates the complete fog of war system');
  printInfo('including GPS tracking, persistence, performance, and visual rendering.');
  console.log();
  
  const allSuites = [
    ...testSuites,
    ...performanceBenchmarks,
    ...regressionTests,
  ];
  
  const results = [];
  
  // Run core functionality tests
  printSection('Core Functionality Tests');
  for (const suite of testSuites) {
    const result = await runTestSuite(suite);
    results.push({ suite, ...result });
    console.log();
  }
  
  // Run performance benchmarks
  printSection('Performance Benchmarks');
  for (const suite of performanceBenchmarks) {
    const result = await runTestSuite(suite);
    results.push({ suite, ...result });
    console.log();
  }
  
  // Run regression tests
  printSection('Regression Tests');
  for (const suite of regressionTests) {
    const result = await runTestSuite(suite);
    results.push({ suite, ...result });
    console.log();
  }
  
  // Generate and display report
  const report = await generateReport(results);
  printSummary(report);
  
  // Exit with appropriate code
  const hasFailures = results.some(r => !r.success && !r.skipped);
  if (hasFailures) {
    printError('\nSome tests failed. Please review the results above.');
    process.exit(1);
  } else {
    printSuccess('\nAll tests passed successfully! 🎉');
    process.exit(0);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  printError(`Uncaught exception: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  printError(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Run the validation
if (require.main === module) {
  main().catch(error => {
    printError(`Validation failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = {
  runTestSuite,
  generateReport,
  calculateRequirementsCoverage,
};