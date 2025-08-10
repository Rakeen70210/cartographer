# Test Data Consistency Guide

This document explains how to use the standardized test data factories and mocks to ensure consistency across all test files.

## Overview

The test suite now uses standardized data factories and mock implementations to ensure:
- Consistent data structures across all tests
- Realistic timing expectations that account for system variability
- Aligned mock behaviors that match the fixed implementations

## Key Files

### Test Data Factories (`__tests__/mocks/testDataFactories.js`)
Contains factory functions for creating consistent mock data:
- `createMockLocation()` - Standard location data
- `createMockStatisticsData()` - Standard statistics data
- `createMockNetworkState()` - Standard network state data
- And many more...

### Updated Mocks (`__tests__/mocks/updatedMocks.js`)
Contains mock implementations that match the fixed function behaviors:
- Network utilities with proper timeout handling
- Distance calculator with correct formatting
- World exploration calculator with enhanced validation
- Performance optimizers with realistic timing

### Test Setup (`__tests__/setup/testSetup.js`)
Provides standardized test data sets and utilities:
- `STANDARD_TEST_DATA` - Pre-configured data sets for different scenarios
- `ERROR_SCENARIOS` - Standardized error test cases
- `GEOMETRY_TEST_CASES` - Valid and invalid geometry examples
- `TEST_CONSTANTS` - Consistent values used across tests

### Jest Setup (`__tests__/setup/jestSetup.js`)
Global Jest configuration and utilities:
- Consistent mock implementations
- Global test utilities
- Performance and error testing helpers
- Standardized timeout values

### Standard Mocks (`__tests__/setup/standardMocks.js`)
Factory functions for creating consistent mocks:
- Database mocks with realistic behaviors
- Network mocks with proper error handling
- Component mocks with correct accessibility
- Hook mocks with consistent return values

### Performance Expectations (`__tests__/config/performanceExpectations.js`)
Realistic timing expectations that account for system variability:
- Environment-specific multipliers (CI, local, mobile)
- Adjusted expectations for different operation types
- Helper functions for performance testing

## Usage Examples

### Basic Test Setup

```javascript
import { setupStandardMocks, TEST_CONSTANTS } from '../setup/testSetup.js';
import { applyStandardMocks } from '../setup/standardMocks.js';

describe('My Component', () => {
  beforeEach(() => {
    // Apply all standard mocks
    applyStandardMocks();
    
    // Or setup specific test data
    const { mockLocations, mockStatistics } = setupStandardMocks('SMALL_DATASET');
  });
});
```

### Using Test Data Factories

```javascript
import { 
  createMockLocations, 
  createMockStatisticsData,
  createMockNetworkState 
} from '../mocks/testDataFactories.js';

test('should handle location data', () => {
  const locations = createMockLocations(5); // Creates 5 consistent locations
  const statistics = createMockStatisticsData({
    totalDistance: { miles: 10, kilometers: 16 }
  });
  
  // Test with consistent data...
});
```

### Performance Testing

```javascript
import { 
  getDistanceCalculationExpectation,
  measurePerformance 
} from '../config/performanceExpectations.js';

test('should calculate distance efficiently', async () => {
  const datasetSize = 1000;
  const expectation = getDistanceCalculationExpectation(datasetSize);
  
  const result = await measurePerformance(
    () => calculateTotalDistance(locations),
    expectation,
    'distance calculation'
  );
  
  expect(result.passed).toBe(true);
});
```

### Error Scenario Testing

```javascript
import { setupErrorScenario } from '../setup/testSetup.js';

test('should handle network errors', async () => {
  const { error, networkState, expectedBehavior } = setupErrorScenario('NETWORK_ERROR');
  
  // Mock the error condition
  mockNetworkUtils.getCurrentState.mockRejectedValue(error);
  
  // Test error handling...
  expect(expectedBehavior).toBe('fallback_to_offline');
});
```

### Geometry Testing

```javascript
import { setupGeometryTestCase } from '../setup/testSetup.js';

test('should validate polygon geometry', () => {
  const validPolygon = setupGeometryTestCase('VALID_CASES', 'simple_polygon');
  const invalidGeometry = setupGeometryTestCase('INVALID_CASES', 'point_geometry');
  
  expect(validateGeometryForArea(validPolygon)).toBe(true);
  expect(validateGeometryForArea(invalidGeometry)).toBe(false);
});
```

## Best Practices

### 1. Use Standard Data Factories
Always use the provided factory functions instead of creating mock data inline:

```javascript
// ✅ Good
const locations = createMockLocations(3);

// ❌ Bad
const locations = [
  { id: 1, latitude: 37.7749, longitude: -122.4194, timestamp: 1640995200000 },
  // ... manually created data
];
```

### 2. Use Consistent Test Constants
Reference `TEST_CONSTANTS` for consistent values:

```javascript
// ✅ Good
expect(location.latitude).toBe(TEST_CONSTANTS.DEFAULT_LATITUDE);

// ❌ Bad
expect(location.latitude).toBe(37.7749);
```

### 3. Use Realistic Performance Expectations
Use the performance expectation helpers instead of hardcoded values:

```javascript
// ✅ Good
const expectation = getDistanceCalculationExpectation(datasetSize);
expect(actualTime).toBeLessThan(expectation);

// ❌ Bad
expect(actualTime).toBeLessThan(1000); // May fail on slower systems
```

### 4. Use Standard Error Scenarios
Use predefined error scenarios for consistent error testing:

```javascript
// ✅ Good
const { error, expectedBehavior } = setupErrorScenario('DATABASE_ERROR');

// ❌ Bad
const error = new Error('Some error'); // Inconsistent error messages
```

### 5. Validate Data Consistency
Use the provided validation helpers:

```javascript
// ✅ Good
import { commonAssertions } from '../setup/testSetup.js';
commonAssertions.expectValidLocation(location);

// ❌ Bad
expect(typeof location.id).toBe('number'); // Manual validation
```

## Migration Guide

To update existing tests to use the standardized approach:

1. **Replace inline mock data** with factory functions
2. **Update hardcoded expectations** with dynamic calculations
3. **Use standard mock implementations** instead of custom mocks
4. **Add consistent test setup** using the provided utilities
5. **Update performance expectations** to account for system variability

## Troubleshooting

### Tests Failing Due to Timing
If tests are failing due to timing issues:
1. Check if you're using realistic performance expectations
2. Consider the test environment (CI vs local)
3. Use the environment multipliers in performance expectations

### Inconsistent Mock Behaviors
If mocks behave differently across tests:
1. Ensure you're using `applyStandardMocks()`
2. Check that mocks are cleared between tests (`clearMocks: true` in Jest config)
3. Verify mock implementations match the fixed function behaviors

### Data Structure Mismatches
If tests fail due to data structure issues:
1. Use the provided factory functions
2. Validate data using the provided validation helpers
3. Check that all tests use the same `TEST_CONSTANTS`

## Contributing

When adding new test data or mocks:
1. Add factory functions to `testDataFactories.js`
2. Update standard mocks in `standardMocks.js`
3. Add constants to `TEST_CONSTANTS` in `testSetup.js`
4. Update performance expectations if needed
5. Document the changes in this README