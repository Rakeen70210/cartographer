# Design Document

## Overview

This design addresses the systematic fixing of 129 failing tests across multiple modules in the Cartographer application. The failures span statistics UI components, geospatial calculations, network utilities, caching systems, and performance optimizations. The design provides a comprehensive approach to identify root causes and implement targeted fixes while maintaining code quality and functionality.

## Architecture

### Problem Categories

The failing tests fall into several distinct categories:

1. **UI Component Issues**: Missing testID attributes and incorrect component structure
2. **Geospatial Calculation Errors**: Validation logic and formatting inconsistencies
3. **Network Utility Edge Cases**: Timeout handling and connectivity detection
4. **Offline Statistics Logic**: Hook state management and data flow issues
5. **Cache Management Problems**: Data persistence and retrieval failures
6. **Performance Test Failures**: Timing expectations and resource management
7. **Distance Calculation Formatting**: Precision and display format mismatches

### Design Principles

1. **Minimal Impact**: Fix tests without breaking existing functionality
2. **Root Cause Focus**: Address underlying issues rather than just test symptoms
3. **Consistency**: Ensure similar patterns across all modules
4. **Performance Preservation**: Maintain or improve performance characteristics
5. **Type Safety**: Leverage TypeScript for better error prevention

## Components and Interfaces

### Statistics Screen Component Fixes

**Issue**: Missing `testID="statistics-screen"` attribute on main container
**Solution**: Add testID to the main SafeAreaView container

```typescript
// Current structure (missing testID)
<SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>

// Fixed structure (with testID)
<SafeAreaView 
  style={[styles.container, { backgroundColor }]} 
  edges={['top']}
  testID="statistics-screen"
>
```

### World Exploration Calculator Validation

**Issue**: `validateGeometryForArea` function has incorrect validation logic for complex geometries
**Solution**: Improve validation to handle edge cases properly

```typescript
// Enhanced validation logic
export const validateGeometryForArea = (geojson: any): boolean => {
  try {
    if (!geojson || typeof geojson !== 'object') return false;
    
    const geometry = geojson.type === 'Feature' ? geojson.geometry : geojson;
    if (!geometry?.type) return false;
    
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return false;
    
    // Enhanced coordinate validation
    if (!geometry.coordinates || !Array.isArray(geometry.coordinates)) return false;
    
    if (geometry.type === 'Polygon') {
      return validatePolygonCoordinates(geometry.coordinates);
    } else {
      return validateMultiPolygonCoordinates(geometry.coordinates);
    }
  } catch {
    return false;
  }
};
```

### Offline Statistics Hook Fixes

**Issue**: Multiple state management and data flow problems
**Solution**: Fix variable scoping, data initialization, and network state handling

```typescript
// Fix undefined variable reference
const handleNetworkStateChange = useCallback((networkState: any) => {
  const isOnline = networkState.isConnected && networkState.isInternetReachable;
  
  setState(prevState => {
    const wasOffline = prevState.isOffline;
    
    const newState = {
      ...prevState,
      isOffline: !isOnline,
      networkStatus: {
        isConnected: isOnline,
        connectionType: networkState.type,
        lastOnlineTime: isOnline ? Date.now() : prevState.networkStatus.lastOnlineTime
      }
    };

    // If we just came back online, refresh data
    if (isOnline && wasOffline && opts.enableAutoRefresh) {
      logger.debug('useOfflineStatistics: Network restored, refreshing data');
      fetchStatisticsData(false);
    }
    
    return newState;
  });
}, [fetchStatisticsData, opts.enableAutoRefresh]);
```

### Network Utils Edge Case Handling

**Issue**: Timeout and connectivity detection not working as expected
**Solution**: Improve timeout handling and fallback logic

```typescript
// Enhanced connectivity testing with proper timeout
async testConnectivity(options: ConnectivityOptions = {}): Promise<boolean> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  for (let attempt = 1; attempt <= opts.retryAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

      const response = await fetch(opts.testUrl, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      if (attempt === opts.retryAttempts) return false;
      await new Promise(resolve => setTimeout(resolve, opts.retryDelay));
    }
  }
  return false;
}
```

### Distance Calculator Formatting

**Issue**: Inconsistent precision and formatting for edge cases
**Solution**: Standardize formatting logic with proper precision handling

```typescript
export const formatDistance = (distance: number, unit: 'miles' | 'kilometers'): string => {
  // Handle special cases
  if (distance === 0) return `0 ${unit === 'miles' ? 'miles' : 'km'}`;
  if (isNaN(distance)) return `NaN ${unit === 'miles' ? 'miles' : 'km'}`;
  if (distance === Infinity) return `∞ ${unit === 'miles' ? 'miles' : 'km'}`;
  if (distance === -Infinity) return `-∞ ${unit === 'miles' ? 'miles' : 'km'}`;

  // Determine precision based on magnitude
  let precision = 2;
  if (Math.abs(distance) >= 100) precision = 1;
  if (Math.abs(distance) >= 1000) precision = 0;

  const formatted = distance.toFixed(precision);
  return `${formatted} ${unit === 'miles' ? 'miles' : 'km'}`;
};
```

### Cache Manager Improvements

**Issue**: Cache operations failing due to timing and concurrency issues
**Solution**: Implement proper error handling and synchronization

```typescript
async get<T>(key: string): Promise<T | null> {
  try {
    const cached = await getStatisticsCache(key);
    if (!cached) return null;

    const now = Date.now();
    const age = now - cached.timestamp;

    if (age > this.config.defaultTTL) {
      await this.delete(key);
      return null;
    }

    const entry: CacheEntry<T> = JSON.parse(cached.cache_value);
    
    // Update access statistics asynchronously to avoid blocking
    setImmediate(async () => {
      try {
        entry.accessCount = (entry.accessCount || 0) + 1;
        entry.lastAccessed = now;
        await saveStatisticsCache(key, entry);
      } catch (error) {
        logger.debug('Cache access update failed:', error);
      }
    });

    return entry.value;
  } catch (error) {
    logger.error('Cache get error:', error);
    return null;
  }
}
```

## Data Models

### Test Expectation Alignment

**Statistics Screen Test Data Model**:
```typescript
interface StatisticsScreenTestExpectations {
  hasMainTestId: boolean; // testID="statistics-screen"
  handlesUndefinedData: boolean;
  handlesNullData: boolean;
  handlesUnmountingDuringLoad: boolean;
  displaysLoadingStates: boolean;
}
```

**Geospatial Validation Model**:
```typescript
interface GeometryValidationRules {
  acceptsComplexMultiPolygon: boolean;
  rejectsMalformedCoordinates: boolean;
  handlesNestedFeatures: boolean;
  requiresMinimumCoordinates: boolean;
}
```

**Network State Model**:
```typescript
interface NetworkTestExpectations {
  timeoutReturnsFailure: boolean;
  errorStateHandling: boolean;
  offlineDetection: boolean;
  connectionQualityAssessment: boolean;
  connectionWaitTimeout: boolean;
}
```

## Error Handling

### Comprehensive Error Recovery

1. **Graceful Degradation**: Components should render with fallback states when data is unavailable
2. **Error Boundaries**: Wrap critical components with error boundaries to prevent crashes
3. **Timeout Handling**: All network operations should have configurable timeouts
4. **Cache Fallbacks**: When primary operations fail, attempt to use cached data
5. **Validation Guards**: Add input validation to prevent invalid data from causing failures

### Error Logging Strategy

```typescript
// Standardized error handling pattern
const handleOperationWithFallback = async <T>(
  operation: () => Promise<T>,
  fallback: () => T,
  context: string
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    logger.error(`${context}: Operation failed, using fallback:`, error);
    return fallback();
  }
};
```

## Testing Strategy

### Test Fix Categories

1. **Component Structure Tests**: Ensure all required testIDs are present
2. **Edge Case Validation Tests**: Verify proper handling of boundary conditions
3. **Network Simulation Tests**: Mock network states and timeouts accurately
4. **Performance Benchmark Tests**: Adjust timing expectations to realistic values
5. **Cache Behavior Tests**: Verify cache operations work under various conditions

### Test Data Consistency

```typescript
// Standardized test data factories
const createMockStatisticsData = (overrides = {}) => ({
  totalDistance: { miles: 0, kilometers: 0 },
  worldExploration: { percentage: 0, totalAreaKm2: 510072000, exploredAreaKm2: 0 },
  uniqueRegions: { countries: 0, states: 0, cities: 0 },
  remainingRegions: { countries: 195, states: 3142, cities: 10000 },
  hierarchicalBreakdown: [],
  lastUpdated: Date.now(),
  isOfflineData: false,
  dataSource: 'online',
  networkStatus: { isConnected: true, connectionType: 'wifi' },
  ...overrides
});
```

### Mock Improvements

```typescript
// Enhanced network mocking
const mockNetworkUtils = {
  testConnectivity: jest.fn(),
  getCurrentState: jest.fn(),
  isOffline: jest.fn(),
  getConnectionQuality: jest.fn(),
  waitForConnection: jest.fn()
};

// Configure mocks based on test scenario
const setupNetworkMocks = (scenario: 'online' | 'offline' | 'timeout') => {
  switch (scenario) {
    case 'offline':
      mockNetworkUtils.testConnectivity.mockResolvedValue(false);
      mockNetworkUtils.isOffline.mockResolvedValue(true);
      break;
    case 'timeout':
      mockNetworkUtils.testConnectivity.mockImplementation(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );
      break;
    default:
      mockNetworkUtils.testConnectivity.mockResolvedValue(true);
      mockNetworkUtils.isOffline.mockResolvedValue(false);
  }
};
```

## Implementation Approach

### Phase 1: Critical UI Fixes
- Add missing testID attributes
- Fix component structure issues
- Ensure proper error state handling

### Phase 2: Logic and Validation Fixes
- Fix geospatial validation functions
- Correct formatting and precision issues
- Improve edge case handling

### Phase 3: Network and Async Fixes
- Fix timeout and connectivity detection
- Improve offline state management
- Enhance error recovery mechanisms

### Phase 4: Performance and Cache Fixes
- Optimize cache operations
- Fix timing-sensitive tests
- Improve concurrent operation handling

### Phase 5: Integration and Verification
- Run full test suite
- Verify no regressions introduced
- Update test expectations where appropriate

Each phase will be implemented incrementally with verification at each step to ensure no new issues are introduced while fixing existing ones.