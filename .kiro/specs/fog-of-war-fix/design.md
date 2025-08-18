# Design Document

## Overview

The fog of war feature needs to be fixed to properly subtract revealed areas from a world-covering polygon, creating holes in the fog overlay where the user has been. The current implementation shows a solid fog overlay over the entire world instead of revealing explored areas.

## Architecture

The fog of war system consists of three main components:

1. **Revealed Area Management**: Tracks and stores areas the user has visited
2. **Fog Calculation Engine**: Computes the fog overlay by subtracting revealed areas from world polygon
3. **Map Rendering Layer**: Displays the calculated fog overlay on the Mapbox map

## Components and Interfaces

### 1. Fog Calculation Engine

**Location**: `utils/fogCalculation.ts` and `hooks/useFogCalculation.ts`

**Current Issues**: 
1. Fog calculations are failing with "All fog calculations failed, using world fog" error
2. Infinite logging loops causing performance issues
3. Excessive debug output making logs unreadable
4. Fog calculation failures in Android emulator environment

**Root Causes**:
- Geometry validation may be too strict, causing valid geometries to be rejected
- Error handling is triggering continuous retry loops
- Debug logging is not properly throttled or controlled
- Fallback strategies may not be working correctly in emulator environments
- Initial fog calculation may be failing when no revealed areas exist

**Updated Implementation Strategy**:
- Implement logging throttling and rate limiting for debug messages
- Add proper error recovery without infinite retry loops
- Improve geometry validation to be more permissive of valid edge cases
- Ensure fallback strategies work reliably in all environments
- Add specific handling for empty revealed areas scenarios

### 2. Revealed Area Processing

**Location**: `app/(tabs)/map.tsx` - `loadRevealedAreas()` and related functions

**Current State**: Working correctly - loads and unions revealed areas from database

**Enhancement Needed**: Ensure revealed areas are properly formatted for difference operations

### 3. Map Layer Rendering

**Location**: `app/(tabs)/map.tsx` - MapboxGL ShapeSource and FillLayer

**Current State**: Renders fog overlay correctly but receives wrong geometry

**No Changes Needed**: The rendering layer will work correctly once proper fog geometry is provided

## Geometry Validation and Sanitization

### Validation Functions

```typescript
/**
 * Validates that a geometry is a proper Feature<Polygon>
 */
const isValidPolygonFeature = (feature: any): feature is Feature<Polygon> => {
  return feature &&
         feature.type === 'Feature' &&
         feature.geometry &&
         feature.geometry.type === 'Polygon' &&
         feature.geometry.coordinates &&
         Array.isArray(feature.geometry.coordinates) &&
         feature.geometry.coordinates.length > 0;
};

/**
 * Sanitizes geometry for difference operations
 */
const sanitizeGeometry = (feature: Feature<Polygon>): Feature<Polygon> | null => {
  try {
    // Ensure coordinates are valid numbers
    // Remove duplicate consecutive points
    // Ensure polygon is closed
    // Validate coordinate ranges
    return feature;
  } catch (error) {
    logger.error('Geometry sanitization failed:', error);
    return null;
  }
};
```

### Geometry Debugging

```typescript
/**
 * Logs detailed geometry information for debugging
 */
const debugGeometry = (feature: any, name: string) => {
  logger.debug(`${name} geometry:`, {
    type: feature?.type,
    geometryType: feature?.geometry?.type,
    hasCoordinates: !!feature?.geometry?.coordinates,
    coordinateCount: feature?.geometry?.coordinates?.length,
    firstCoordinate: feature?.geometry?.coordinates?.[0]?.[0]
  });
};
```

## Data Models

### Fog Geometry Structure

```typescript
// Input: World polygon covering entire earth
const worldPolygon: Feature<Polygon> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [[[-180, -90], [-180, 90], [180, 90], [180, -90], [-180, -90]]]
  }
};

// Input: Revealed areas (union of all user-visited buffer zones)
const revealedAreas: Feature<Polygon> = {
  type: 'Feature',
  properties: {},
  geometry: { /* Polygon geometry of revealed areas */ }
};

// Output: Fog with holes cut out for revealed areas
const fogWithHoles: Feature<Polygon | MultiPolygon> = difference(worldPolygon, revealedAreas);
```

### Error Handling Cases

1. **No revealed areas**: Return viewport polygon as fog (not world polygon for performance)
2. **Invalid revealed geometry**: Validate and sanitize geometry, log error and return viewport fog
3. **Geometry validation fails**: Log detailed geometry information and return viewport fog as fallback
4. **Difference operation fails**: Log error with geometry details and return viewport fog as fallback
5. **Difference returns null**: Log warning and return viewport fog
6. **FeatureCollection instead of Feature**: Extract first feature or convert appropriately
7. **Missing geometry property**: Log error and return viewport fog

## Error Handling

### Current Error Scenarios

1. **"All fog calculations failed, using world fog"** - Primary fog calculation is failing consistently
2. **Infinite logging loops** - Error conditions are causing continuous retry attempts with logging
3. **Android emulator failures** - Fog calculation not working in development environment
4. **Excessive debug output** - Performance impact from too much logging

### Updated Error Handling Strategy

**Logging Control**:
1. Implement logging rate limiting to prevent spam
2. Use log levels appropriately (debug vs info vs warn vs error)
3. Add session-based logging to avoid repeated messages
4. Throttle viewport change logging during map interactions

**Error Recovery**:
1. Implement circuit breaker pattern for failed fog calculations
2. Add exponential backoff for retry attempts
3. Ensure fallback strategies don't trigger infinite loops
4. Provide graceful degradation when calculations consistently fail

**Geometry Validation**:
1. Make geometry validation more permissive for edge cases
2. Add specific handling for empty/null revealed areas
3. Ensure viewport bounds are always valid before fog calculation
4. Add geometry repair functions for common issues

### Performance Considerations

**Polygon Complexity**: Large numbers of revealed areas can create complex polygons that are expensive to process.

**Solution**: The current union operation already handles this by merging all revealed areas into a single polygon before the difference operation.

## Testing Strategy

### Unit Testing

1. **Test difference operation with simple geometries**
   - Single circular revealed area
   - Multiple non-overlapping revealed areas
   - Overlapping revealed areas

2. **Test error handling**
   - Invalid polygon inputs
   - Null/undefined inputs
   - Turf operation failures

### Integration Testing

1. **Test with real location data**
   - Load actual revealed areas from database
   - Verify fog calculation with complex geometries
   - Test performance with large datasets

### Emulator Testing

1. **Mock location simulation**
   - Set initial location in emulator
   - Move location to create revealed areas
   - Verify fog updates correctly
   - Test persistence across app restarts

## Implementation Approach

### Phase 1: Implement Viewport-Based Fog (Recommended)

1. **Viewport Detection**
   - Get current map bounds from Mapbox camera
   - Create fog polygon only for visible area
   - Update fog when viewport changes

2. **Efficient Fog Calculation**
   - Generate viewport-sized fog polygon
   - Subtract only revealed areas within viewport
   - Use simplified geometry for better performance

3. **Dynamic Updates**
   - Listen to map region changes
   - Regenerate fog tiles for new viewport
   - Optimize for smooth panning/zooming

### Phase 2: Alternative - Layer-Based Approach

1. **Fog Overlay Layer**
   - Create full-screen dark overlay
   - Use lower z-index than revealed areas

2. **Revealed Areas as Mask**
   - Render revealed areas with transparency
   - Use layer blending to "punch through" fog
   - Leverage Mapbox's native layer system

### Phase 3: Fallback - Optimized Difference Operation

1. **Simplified World Polygon**
   - Use viewport-clipped world polygon instead of full earth
   - Perform difference operation on smaller geometry
   - Add polygon simplification for complex revealed areas

2. **Performance Monitoring**
   - Add timing measurements for fog calculations
   - Monitor polygon complexity and vertex counts
   - Implement automatic simplification thresholds

## Performance Considerations

### Current Approach Issues

The current world-polygon-with-holes approach has significant performance problems:

1. **Massive polygon complexity**: A world-spanning polygon with many holes becomes extremely complex
2. **Rendering overhead**: Mapbox has to render and clip a massive polygon covering the entire earth
3. **Memory usage**: Large complex polygons consume significant memory
4. **Geometric operations**: Difference operations on world-scale polygons are computationally expensive

### Alternative Approach: Viewport-Based Fog Tiles

**Better Strategy**: Instead of a single world polygon, use a tile-based approach that only renders fog in the current viewport.

#### Tile-Based Fog System

1. **Viewport Detection**: Calculate current map viewport bounds
2. **Tile Generation**: Create fog tiles only for visible area
3. **Revealed Area Clipping**: Subtract revealed areas from viewport tiles only
4. **Dynamic Updates**: Regenerate fog tiles when viewport changes

#### Benefits

- **Reduced complexity**: Only process polygons in current view
- **Better performance**: Smaller polygons render faster
- **Memory efficiency**: Only store fog geometry for visible area
- **Scalability**: Performance doesn't degrade with global exploration

### Hybrid Approach: Revealed Areas as Positive Geometry

**Even Better Strategy**: Instead of subtracting from world polygon, render revealed areas directly and use map styling for fog effect.

#### Implementation

1. **Inverted Rendering**: Use Mapbox's layer ordering and blending modes
2. **Revealed Layer**: Render revealed areas as normal map
3. **Fog Layer**: Apply dark overlay to entire map with lower z-index
4. **Masking**: Use revealed areas as mask to "punch through" fog layer

#### Technical Implementation

```typescript
// Instead of: world polygon - revealed areas = fog
// Use: revealed areas as mask over dark overlay

<MapboxGL.ShapeSource id="fogOverlay" shape={fullViewportPolygon}>
  <MapboxGL.FillLayer
    id="fogLayer"
    style={{
      fillColor: '#1E293B',
      fillOpacity: 0.8,
    }}
  />
</MapboxGL.ShapeSource>

<MapboxGL.ShapeSource id="revealedAreas" shape={revealedAreasGeoJSON}>
  <MapboxGL.FillLayer
    id="revealedLayer"
    style={{
      fillColor: 'transparent',
      fillOpacity: 0,
    }}
    filter={['==', '$type', 'Polygon']}
  />
</MapboxGL.ShapeSource>
```

### Technical Considerations

#### Coordinate System Compatibility

- Mapbox uses longitude/latitude coordinates
- Turf.js operations work with GeoJSON standard coordinates
- Current implementation already handles this correctly

#### Viewport-Based Calculations

- Calculate visible bounds using Mapbox camera state
- Generate fog geometry only for current viewport
- Update fog when user pans/zooms map

#### Memory and Performance

- Limit polygon complexity through simplification
- Use viewport culling to reduce processing
- Consider level-of-detail for distant areas
- Monitor frame rates and memory usage