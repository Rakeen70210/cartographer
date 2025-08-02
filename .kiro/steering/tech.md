---
inclusion: always
---

# Technology Stack & Implementation Guidelines

## Core Framework Requirements
- **React Native 0.79.4** with **React 19.0.0** - Use React Native components, not web equivalents
- **Expo SDK ~53.0** - Always use Expo APIs when available over bare React Native
- **TypeScript ~5.8** with strict mode - All code must pass strict TypeScript checks
- **Expo Router ~5.1** - Use file-based routing in `app/` directory

## Critical Dependencies & Usage Patterns

### Geospatial Operations (REQUIRED for fog features)
- **@rnmapbox/maps ^10.1.39** - Primary mapping engine
  - Use `MapView` component for all map rendering
  - Implement viewport change handlers for fog updates
  - Access camera/viewport bounds via `onCameraChanged`
- **@turf/turf ^7.2.0** - Geospatial calculations
  - Use `buffer()` for creating revealed areas around GPS points
  - Use `union()` to merge overlapping revealed areas
  - Use `bbox()` and `bboxPolygon()` for viewport calculations
- **@turf/difference ^7.2.0** - Fog geometry calculation
  - Use `difference()` between viewport polygon and revealed areas
  - Always validate geometry before operations (check for null/undefined)

### Data Persistence Patterns
- **expo-sqlite ~15.2** - All persistent data must use SQLite
  - Use `@/utils/database.ts` for all database operations
  - Never perform direct SQL queries in components
  - Always use transactions for multi-operation updates
- **expo-location ~18.1** - GPS tracking
  - Request permissions before accessing location
  - Use `watchPositionAsync` for real-time tracking
  - Implement error handling for location unavailable scenarios

### Performance Requirements
- **Viewport-based calculations**: Only process data within current map bounds
- **Debouncing**: Use 300ms debounce for map viewport changes
- **Polygon simplification**: Apply to complex geometries before rendering
- **Memory management**: Clean up map listeners in useEffect cleanup

## Development Commands (Use These Exact Commands)
```bash
# Primary development (Android preferred for testing)
npx expo run:android     # Use this for fog of war testing
npm start               # Expo development server

# Testing location features
# Use Android emulator Extended Controls > Location for GPS simulation

# Code quality
npm run lint           # Must pass before commits
```

## Implementation Rules

### Geospatial Code Patterns
```typescript
// Always validate Turf.js operations
const fogGeometry = turf.difference(viewportPolygon, revealedAreas);
if (!fogGeometry) {
  // Handle case where difference returns null
  return defaultFogGeometry;
}

// Use viewport bounds for all calculations
const bounds = await mapRef.current?.getVisibleBounds();
const viewportBbox = turf.bbox(turf.bboxPolygon(bounds));
```

### Database Integration
- Use `@/utils/database.ts` for all SQLite operations
- Never perform raw SQL in components
- Always use prepared statements for user data
- Implement proper error handling and rollbacks

### Map Component Requirements
- Always use `@rnmapbox/maps` components
- Implement proper cleanup for map event listeners
- Use viewport-based rendering for performance
- Handle map loading states and errors

### Location Tracking
- Request permissions before accessing GPS
- Implement background location tracking with `expo-task-manager`
- Handle location errors gracefully
- Store all location data in SQLite immediately

## Testing Requirements
- **Primary platform**: Android (use `npx expo run:android`)
- **GPS simulation**: Android emulator Extended Controls > Location
- **Performance testing**: Test with large datasets of revealed areas
- **Error scenarios**: Test with location disabled, network offline