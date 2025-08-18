# Logging Optimization Implementation

This document describes the logging optimizations implemented to address excessive debug output and infinite logging loops in the fog-of-war system.

## Overview

The logging system has been enhanced with:
- **Rate limiting** to prevent log spam
- **Session-based logging** to avoid repeated messages
- **Throttled logging** for high-frequency operations
- **Environment-based configuration** for different deployment scenarios
- **Viewport-specific throttling** for map interactions

## Key Features

### 1. Enhanced Logger (`utils/logger.ts`)

#### New Logging Methods

```typescript
// Session-based logging (logs once per session)
logger.debugOnce('This will only log once');
logger.infoOnce('Session info message');
logger.warnOnce('Session warning');

// Throttled logging (with custom time windows)
logger.debugThrottled('High frequency message', 5000); // 5 second throttle
logger.infoThrottled('Throttled info', 3000);
logger.warnThrottled('Throttled warning', 2000);

// Viewport-specific logging (heavily throttled for map interactions)
logger.debugViewport('Viewport changed');
logger.infoViewport('Viewport info');
```

#### Configuration

```typescript
import { setLoggingConfig, getLoggingConfig } from '@/utils/logger';

// Get current configuration
const config = getLoggingConfig();

// Set custom configuration
setLoggingConfig({
  enableDebug: false,
  enableInfo: true,
  throttleViewportLogs: true,
  rateLimitWindow: 5000,
  maxLogsPerWindow: 10
});
```

### 2. Logging Configuration (`utils/loggingConfig.ts`)

#### Predefined Presets

```typescript
import { applyLoggingPreset } from '@/utils/loggingConfig';

// Development - full logging
applyLoggingPreset('development');

// Production - minimal logging
applyLoggingPreset('production');

// Testing - errors and warnings only
applyLoggingPreset('testing');

// Debug - verbose logging for troubleshooting
applyLoggingPreset('debug');

// Silent - errors only
applyLoggingPreset('silent');
```

#### Environment Auto-Detection

The system automatically configures logging based on:
- `process.env.LOG_LEVEL` environment variable
- `__DEV__` flag for development detection
- `NODE_ENV` for production/test detection

### 3. Optimized Usage in Codebase

#### Fog Calculation (`utils/fogCalculation.ts`)
- Replaced excessive `logger.debug()` with `logger.debugOnce()` and `logger.debugThrottled()`
- Added appropriate throttling for viewport-related operations
- Reduced log spam during fog calculations

#### Map Interactions (`hooks/useFogCalculation.ts`)
- Viewport changes use `logger.debugViewport()` for heavy throttling
- Location updates use throttled logging
- Circuit breaker messages are throttled to prevent spam

#### Map Event Handlers (`utils/mapEventHandlers.ts`)
- Camera changes use viewport-specific logging
- Map load events use session-based logging

## Configuration Options

### LoggingConfig Interface

```typescript
interface LoggingConfig {
  enableDebug: boolean;           // Enable debug logging
  enableInfo: boolean;            // Enable info logging
  enableWarning: boolean;         // Enable warning logging
  enableError: boolean;           // Enable error logging (always true)
  rateLimitWindow: number;        // Rate limit window in milliseconds
  maxLogsPerWindow: number;       // Max logs per window per message type
  throttleViewportLogs: boolean;  // Throttle viewport-related logs
}
```

### Preset Configurations

| Preset | Debug | Info | Warnings | Rate Limit | Viewport Throttle |
|--------|-------|------|----------|------------|-------------------|
| `development` | ✅ | ✅ | ✅ | 3s / 15 logs | ✅ |
| `production` | ❌ | ❌ | ✅ | 10s / 5 logs | ✅ |
| `testing` | ❌ | ❌ | ✅ | 1s / 3 logs | ✅ |
| `debug` | ✅ | ✅ | ✅ | 1s / 50 logs | ❌ |
| `silent` | ❌ | ❌ | ❌ | 30s / 1 log | ✅ |

## Usage Examples

### Basic Usage

```typescript
import { logger } from '@/utils/logger';

// Regular logging (subject to rate limiting)
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message'); // Never rate limited

// Session-based logging
logger.debugOnce('This logs once per app session');
logger.infoOnce('Session info');

// Throttled logging
logger.debugThrottled('High frequency operation', 2000); // 2 second throttle
```

### Configuration

```typescript
import { applyLoggingPreset, setLoggingConfig } from '@/utils/loggingConfig';

// Apply preset for production
applyLoggingPreset('production');

// Custom configuration
setLoggingConfig({
  enableDebug: true,
  throttleViewportLogs: false, // Disable viewport throttling for debugging
  rateLimitWindow: 1000,
  maxLogsPerWindow: 100
});
```

### Environment Variables

```bash
# Set log level via environment variable
LOG_LEVEL=debug npm start
LOG_LEVEL=production npm start
LOG_LEVEL=silent npm start
```

## Benefits

### Performance Improvements
- **Reduced log spam**: Rate limiting prevents excessive logging
- **Better performance**: Throttled viewport logging reduces overhead during map interactions
- **Memory efficiency**: Session-based logging prevents memory leaks from repeated messages

### Developer Experience
- **Cleaner logs**: No more infinite loops or repeated messages
- **Environment-appropriate logging**: Different verbosity for development vs production
- **Easy configuration**: Simple presets and custom configuration options

### Debugging Capabilities
- **Targeted logging**: Viewport-specific logging for map debugging
- **Flexible configuration**: Easy to enable verbose logging when needed
- **Preserved error logging**: Critical errors are never throttled

## Migration Guide

### Replacing Existing Logging

```typescript
// Before
logger.debug('Viewport changed'); // Could spam logs

// After
logger.debugViewport('Viewport changed'); // Throttled for viewport changes

// Before
logger.debug('One-time initialization'); // Could repeat

// After
logger.debugOnce('One-time initialization'); // Logs once per session

// Before
logger.debug('High frequency operation'); // Could spam

// After
logger.debugThrottled('High frequency operation', 3000); // Throttled
```

### Environment Setup

Add to your app initialization:

```typescript
import { configureLoggingForEnvironment } from '@/utils/loggingConfig';

// In app startup (already added to app/_layout.tsx)
configureLoggingForEnvironment();
```

## Testing

The logging optimizations can be verified by running:

```bash
node verify-logging.js
```

This script checks that all optimizations are properly implemented and provides usage examples.

## Troubleshooting

### Enable Debug Logging Temporarily

```typescript
import { enableDebugLogging } from '@/utils/loggingConfig';

// Enable verbose logging for troubleshooting
enableDebugLogging();
```

### Disable Debug Logging for Performance

```typescript
import { disableDebugLogging } from '@/utils/loggingConfig';

// Disable debug logging to improve performance
disableDebugLogging();
```

### Fog Calculation Specific Debugging

```typescript
import { enableFogCalculationDebugging } from '@/utils/loggingConfig';

// Enable verbose logging specifically for fog calculation issues
enableFogCalculationDebugging();
```