---
inclusion: fileMatch
fileMatchPattern: ['app/(tabs)/map.tsx', 'utils/database.ts', 'hooks/useLocationTracking.ts']
---

# Fog of War Implementation Guide

## Core Architecture Principles

### Viewport-Only Processing
- **CRITICAL**: Only calculate fog geometry for current map viewport, never globally
- Use `mapRef.current?.getVisibleBounds()` to get viewport bounds
- Create viewport polygon: `bboxPolygon([bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]])`
- Query database with spatial bounds: `WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?`

### Error Handling & Fallbacks
All Turf.js geometric operations must be wrapped in try-catch with viewport fallback:
```typescript
try {
  const fogGeometry = difference(viewportPolygon, revealedAreas);
  return fogGeometry || viewportPolygon;
} catch (error) {
  logger.error('Fog calculation failed', { error, viewport });
  return viewportPolygon; // Show full fog on error
}
```

### Performance Requirements
- Debounce viewport changes (300ms minimum)
- Use async/await for all Turf.js operations
- Log performance warnings if operations exceed 100ms
- Simplify polygons with >1000 vertices before storage

## Implementation Patterns

### Fog Calculation Function
```typescript
const createFogFeatures = async (viewport: Polygon, revealedAreas: Polygon) => {
  if (!viewport || !revealedAreas) return viewport;
  
  try {
    const startTime = Date.now();
    const fogGeometry = difference(viewport, revealedAreas);
    
    if (Date.now() - startTime > 100) {
      logger.warn('Slow fog calculation', { duration: Date.now() - startTime });
    }
    
    return fogGeometry || viewport;
  } catch (error) {
    logger.error('Fog calculation error', { error });
    return viewport;
  }
};
```

### Location Tracking Integration
- Create 50-meter circular buffers around new locations using `buffer()`
- Persist revealed areas immediately (no batching)
- Union all revealed areas before fog calculation
- Store simplified polygons in database

### Database Patterns
- Spatial queries limited to viewport bounds only
- Union revealed areas before geometric operations
- Index location columns for spatial query performance
- Store GeoJSON as TEXT with JSON validation

## Testing Guidelines

### Primary Testing Platform: Android
- Use `npx expo run:android` for fog feature testing
- Android Extended Controls > Location for GPS simulation
- Test viewport changes at multiple zoom levels
- Validate performance with 100+ revealed areas in viewport

### Performance Validation
- Monitor fog calculation timing (<100ms target)
- Test smooth map interaction during fog updates
- Verify debouncing prevents excessive recalculation
- Validate memory usage with large revealed area datasets

## Critical Anti-Patterns

1. **Global fog calculation** - Never process entire world geometry
2. **Missing error handling** - Always wrap Turf.js operations in try-catch
3. **Synchronous operations** - Use async/await for all geometric calculations
4. **Unbounded database queries** - Always limit to viewport area
5. **Missing viewport fallback** - Always return viewport polygon on errors
6. **No debouncing** - Always debounce viewport change events
7. **Complex polygon persistence** - Simplify before database storage

## Code Style Conventions
- Use descriptive variable names: `viewportPolygon`, `revealedAreas`, `fogGeometry`
- Log performance metrics for operations >100ms
- Include error context in all error logs
- Use consistent buffer radius (50 meters) across the application