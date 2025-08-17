---
inclusion: fileMatch
fileMatchPattern: ['app/(tabs)/map.tsx', 'utils/fogCalculation.ts', 'hooks/useFogCalculation.ts', 'hooks/useLocationTracking.ts', 'utils/database.ts']
---

# Fog of War Implementation Guide

## CRITICAL RULES - Always Follow

### 1. Viewport-Only Processing (MANDATORY)
- **NEVER** calculate fog geometry globally - only for current map viewport
- Always get viewport bounds: `mapRef.current?.getVisibleBounds()`
- Create viewport polygon: `turf.bboxPolygon([bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]])`
- Limit database queries: `WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?`

### 2. Error Handling (REQUIRED)
All Turf.js operations MUST be wrapped in try-catch with fallback:
```typescript
try {
  const fogGeometry = turf.difference(viewportPolygon, revealedAreas);
  return fogGeometry || viewportPolygon;
} catch (error) {
  logger.error('Fog calculation failed', { error, viewport });
  return viewportPolygon; // Always show full fog on error
}
```

### 3. Performance Standards (ENFORCE)
- Debounce viewport changes: 300ms minimum
- Performance target: <100ms for fog calculations
- Log warnings if operations exceed 100ms
- Simplify polygons with >1000 vertices before storage

## Required Implementation Patterns

### Fog Calculation Function Template
```typescript
const createFogFeatures = async (viewport: Polygon, revealedAreas: Polygon) => {
  if (!viewport || !revealedAreas) return viewport;
  
  try {
    const startTime = Date.now();
    const fogGeometry = turf.difference(viewport, revealedAreas);
    
    const duration = Date.now() - startTime;
    if (duration > 100) {
      logger.warn('Slow fog calculation', { duration, viewport: viewport.bbox });
    }
    
    return fogGeometry || viewport;
  } catch (error) {
    logger.error('Fog calculation error', { error, viewport: viewport.bbox });
    return viewport;
  }
};
```

### Location Buffer Creation
- Use exactly 50-meter radius: `turf.buffer(point, 0.05, { units: 'kilometers' })`
- Persist revealed areas immediately (no batching)
- Union overlapping areas before fog calculation
- Store simplified polygons in database

### Database Query Patterns
```typescript
// Correct: Viewport-bounded query
const query = `
  SELECT * FROM revealed_areas 
  WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
`;

// Incorrect: Global query
const query = `SELECT * FROM revealed_areas`; // NEVER DO THIS
```

## Required Dependencies & Usage

### Turf.js Operations
- `turf.difference()` - Calculate fog geometry
- `turf.union()` - Merge revealed areas
- `turf.buffer()` - Create location buffers
- `turf.bboxPolygon()` - Create viewport polygon
- `turf.simplify()` - Reduce polygon complexity

### Map Integration
- Use `@rnmapbox/maps` MapView component
- Implement `onCameraChanged` for viewport updates
- Access camera bounds via map ref
- Render fog as GeoJSON source/layer

## Testing Requirements

### Development Commands
```bash
npx expo run:android  # Primary testing platform
# Use Android Extended Controls > Location for GPS simulation
```

### Performance Validation Checklist
- [ ] Fog calculation completes in <100ms
- [ ] Smooth map interaction during fog updates
- [ ] Debouncing prevents excessive recalculation
- [ ] Memory usage stable with 100+ revealed areas
- [ ] Viewport changes trigger appropriate fog updates

## FORBIDDEN Patterns (Never Implement)

1. **Global fog calculation** - Process entire world geometry
2. **Missing error handling** - Unprotected Turf.js operations
3. **Synchronous operations** - Blocking geometric calculations
4. **Unbounded queries** - Database queries without spatial limits
5. **Missing fallbacks** - No viewport polygon return on errors
6. **No debouncing** - Direct viewport change handlers
7. **Complex storage** - Storing unsimplified polygons

## Code Standards

### Variable Naming
- `viewportPolygon` - Current map viewport as polygon
- `revealedAreas` - Union of all revealed location buffers
- `fogGeometry` - Result of difference operation
- `locationBuffer` - 50m buffer around GPS point

### Logging Requirements
- Log performance metrics for operations >100ms
- Include viewport bounds in error logs
- Use structured logging with context objects
- Log fog calculation timing in development mode

### Function Signatures
```typescript
// Fog calculation
createFogFeatures(viewport: Polygon, revealedAreas: Polygon): Promise<Polygon>

// Location processing
createLocationBuffer(point: Point): Polygon

// Database operations
getRevealedAreasInViewport(bounds: BBox): Promise<Polygon[]>
```