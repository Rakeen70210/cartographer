---
inclusion: fileMatch
fileMatchPattern: ['app/(tabs)/map.tsx', 'utils/database.ts', 'hooks/useLocationTracking.ts']
---

# Fog of War Implementation Rules

## Critical Architecture Requirements

### NEVER Create World-Scale Geometries
- **ALWAYS** limit fog calculations to current viewport bounds only
- **NEVER** generate fog geometry for entire earth or large regions
- Use `mapRef.current?.getVisibleBounds()` to get viewport bounds
- Create viewport polygon with `bboxPolygon([bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]])`

### Mandatory Error Handling Pattern
```typescript
try {
  const fogGeometry = difference(viewportPolygon, revealedAreas);
  return fogGeometry;
} catch (error) {
  logger.error('Fog calculation failed', { error, viewport });
  // ALWAYS provide fallback - return viewport as fog
  return viewportPolygon;
}
```

### Required Performance Patterns
- **ALWAYS** debounce viewport change events (minimum 300ms)
- **ALWAYS** use async/await for Turf.js operations
- **ALWAYS** time geometric operations and log if > 100ms
- **ALWAYS** simplify polygons if vertex count > 1000

## Code Implementation Rules

### Fog Calculation Function Structure
```typescript
const createFogFeatures = async (viewport: Polygon, revealedAreas: Polygon) => {
  try {
    // 1. Validate inputs
    if (!viewport || !revealedAreas) return viewport;
    
    // 2. Perform difference operation
    const startTime = Date.now();
    const fogGeometry = difference(viewport, revealedAreas);
    const duration = Date.now() - startTime;
    
    // 3. Log performance if slow
    if (duration > 100) {
      logger.warn('Slow fog calculation', { duration, vertexCount });
    }
    
    return fogGeometry || viewport;
  } catch (error) {
    logger.error('Fog calculation error', { error });
    return viewport; // Fallback to full fog
  }
};
```

### Database Query Patterns
- **ALWAYS** query revealed areas within viewport bounds only
- **ALWAYS** union revealed areas before fog calculation
- **NEVER** load all revealed areas globally
- Use spatial queries: `WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?`

### Location Tracking Integration
- **ALWAYS** create circular buffer around new locations (use `buffer()` from Turf.js)
- **ALWAYS** persist revealed areas immediately after location update
- **NEVER** batch location updates - persist each one individually
- Use consistent buffer radius (e.g., 50 meters)

## Testing Requirements

### Android Emulator Testing (Primary Platform)
- **ALWAYS** test fog features using `npx expo run:android`
- Use Android Extended Controls > Location for GPS simulation
- Test viewport changes at different zoom levels
- Validate fog updates across viewport boundaries
- Test with mock location data for consistent results

### Performance Validation
- Monitor fog calculation timing (should be < 100ms)
- Test with 100+ revealed areas in viewport
- Validate smooth map interaction during fog updates
- Ensure debouncing prevents excessive calculations

## Common Anti-Patterns to Avoid

1. **Global fog calculation** - Never calculate fog outside viewport
2. **Missing try-catch** - Always wrap Turf.js operations
3. **Synchronous operations** - Always use async for geometric calculations  
4. **No fallback strategy** - Always return viewport as fallback fog
5. **Unbounded queries** - Always limit database queries to viewport area
6. **Missing debouncing** - Always debounce viewport change events
7. **Complex polygon storage** - Simplify before database storage