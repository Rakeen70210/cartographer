---
inclusion: always
---

# Technology Stack & Implementation Guidelines

## Core Stack
- **React Native 0.79.4** + **React 19.0.0** - Use RN components, never web equivalents
- **Expo SDK ~53.0** - Prefer Expo APIs over bare React Native
- **TypeScript ~5.8** strict mode - All code must pass strict checks
- **Expo Router ~5.1** - File-based routing in `app/` directory

## Critical Dependencies

### Mapping & Geospatial (MANDATORY)
- **@rnmapbox/maps ^10.1.39** - Primary map engine
  - Use `MapView` for all rendering
  - Handle viewport changes via `onCameraChanged`
  - Always get bounds: `await mapRef.current?.getVisibleBounds()`
- **@turf/turf ^7.2.0** + **@turf/difference ^7.2.0** - Geometry operations
  - `buffer()` for GPS reveal areas
  - `union()` for merging polygons
  - `difference()` for fog calculation
  - **ALWAYS validate**: Check for null/undefined results

### Data & Location
- **expo-sqlite ~15.2** - All persistence through `@/utils/database.ts`
- **expo-location ~18.1** - GPS tracking with `watchPositionAsync`

## Mandatory Patterns

### Geospatial Operations
```typescript
// ALWAYS validate Turf operations
const result = turf.difference(viewport, revealed);
if (!result) return fallbackGeometry;

// Viewport-only processing
const bounds = await mapRef.current?.getVisibleBounds();
const bbox = turf.bbox(turf.bboxPolygon(bounds));
```

### Database Access
- **NEVER** direct SQL in components
- **ALWAYS** use `@/utils/database.ts` functions
- **ALWAYS** use transactions for multi-operations
- **ALWAYS** handle errors and rollbacks

### Performance Rules
- **Viewport-based**: Only process visible map data
- **300ms debounce**: For map viewport changes
- **Cleanup listeners**: In useEffect cleanup functions
- **Simplify polygons**: Before rendering complex geometries

### Location Handling
- **Request permissions** before GPS access
- **Handle errors** gracefully (location disabled/unavailable)
- **Immediate persistence** - save GPS points to SQLite instantly
- **Background tracking** with `expo-task-manager`

## Development Commands
```bash
npx expo run:android    # Primary platform for GPS testing
npm start              # Development server
npm run lint          # Must pass before commits
```

## Testing Requirements
- **Android primary**: Use `npx expo run:android` for GPS features
- **GPS simulation**: Android emulator Extended Controls > Location
- **Performance**: Test with 1000+ revealed areas
- **Error scenarios**: Location disabled, network offline