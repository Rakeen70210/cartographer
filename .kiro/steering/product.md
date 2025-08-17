---
inclusion: always
---

# Cartographer Product Guide

**Cartographer** is a React Native fog-of-war mapping app where users physically explore the real world to reveal map areas through GPS tracking.

## Core Product Rules

### Location-Based Revelation System
- **Buffer zones**: Each GPS point creates a circular revealed area (use `turf.buffer()`)
- **Persistent exploration**: All revealed areas must persist in SQLite between sessions
- **Real-time updates**: Fog updates immediately as users move to new locations
- **Background tracking**: Location tracking continues when app is backgrounded

### Fog of War Implementation
- **Dark overlay**: Unexplored areas covered by semi-transparent dark polygon
- **Viewport-only rendering**: Only calculate fog for visible map bounds (performance critical)
- **Geometric operations**: Use `turf.difference()` between viewport and revealed areas
- **Debounced updates**: 300ms debounce on map viewport changes to prevent excessive calculations

## Mandatory Performance Patterns

### Viewport-Based Processing
```typescript
// ALWAYS limit calculations to visible area
const bounds = await mapRef.current?.getVisibleBounds();
const viewportBbox = turf.bbox(turf.bboxPolygon(bounds));
// Only process data within viewportBbox
```

### Database-First Persistence
- **All location data** → SQLite via `@/utils/database.ts`
- **No direct SQL** in components - use database utility functions
- **Immediate persistence** - save GPS points as they're received
- **Transaction-based** updates for multi-operation changes

### Error-Resilient Geometry
```typescript
// ALWAYS validate Turf.js operations
const result = turf.difference(viewport, revealedAreas);
if (!result) {
  // Handle null geometry case
  return fallbackGeometry;
}
```

## Implementation Requirements

### Map Integration
- **Primary engine**: `@rnmapbox/maps` MapView component
- **Viewport detection**: Use `onCameraChanged` for fog updates
- **Layer management**: Fog as overlay, revealed areas as separate layer
- **Memory cleanup**: Remove map listeners in useEffect cleanup

### Location Tracking
- **Permission flow**: Request location permissions before any GPS operations
- **Error handling**: Graceful degradation when location unavailable
- **Background tasks**: Use `expo-task-manager` for background location updates
- **Accuracy settings**: High accuracy for exploration, balanced for battery life

### Data Architecture
- **Revealed areas**: Store as GeoJSON polygons in SQLite
- **Location history**: Track all GPS points with timestamps
- **Statistics**: Calculate exploration percentages from database queries
- **Cache management**: Implement viewport-based data loading

## Testing & Development

### Primary Development Flow
```bash
npx expo run:android    # Primary platform for GPS testing
# Use Android emulator Extended Controls > Location for GPS simulation
```

### Performance Validation
- Test with 1000+ revealed areas in viewport
- Validate fog rendering at various zoom levels
- Ensure smooth map interaction during fog updates
- Monitor memory usage during extended exploration sessions

### Feature Constraints
- **Global scale**: All features must work worldwide without performance degradation
- **Offline capability**: Core fog functionality works without network
- **Battery optimization**: Location tracking balanced for extended use
- **Storage efficiency**: Optimize polygon storage for long-term exploration data