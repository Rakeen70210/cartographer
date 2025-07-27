# Technology Stack

## Framework & Platform
- **React Native 0.79.4** with **React 19.0.0**
- **Expo SDK ~53.0** for cross-platform development
- **Expo Router ~5.1** for file-based navigation
- **TypeScript ~5.8** with strict mode enabled

## Key Dependencies

### Mapping & Geospatial
- **@rnmapbox/maps ^10.1.39** - Mapbox integration for map rendering and viewport detection
- **@turf/turf ^7.2.0** - Geospatial analysis and operations (buffer, union, bbox, bboxPolygon)
- **@turf/difference ^7.2.0** - Geometric difference operations for viewport-based fog calculation
- **geojson ^0.5.0** - GeoJSON type definitions and utilities

### Fog of War Implementation
- **Viewport-based rendering**: Fog calculations limited to current map viewport for optimal performance
- **Dynamic fog updates**: Fog geometry recalculated on viewport changes with debouncing
- **Geometric operations**: Uses Turf.js difference operations between viewport polygons and revealed areas
- **Performance optimization**: Polygon simplification and complexity monitoring for large datasets

### Data & Storage
- **expo-sqlite ~15.2** - Local SQLite database for location and revealed area persistence
- **expo-location ~18.1** - GPS location services and background tracking
- **expo-task-manager ~13.1** - Background task management for location tracking

### Navigation & UI
- **@react-navigation/native ^7.1.6** - Navigation framework
- **@react-navigation/bottom-tabs ^7.3.10** - Tab-based navigation
- **react-native-reanimated ~3.17** - Smooth animations and gestures
- **react-native-gesture-handler ~2.24** - Touch gesture handling

## Development Tools
- **ESLint** with Expo config for code linting
- **@testing-library/react-native** for component testing
- **TypeScript** with path mapping (`@/*` aliases)

## Build & Deployment
- **EAS Build** (project ID: a6a9146c-c5f1-41ef-9e14-4504ac1e4de8)
- **Metro bundler** for web builds
- **Gradle** for Android builds

## Common Commands

```bash
# Development
npm start                 # Start Expo development server
npx expo run:android     # Run on Android device/emulator (preferred for testing)
npm run android          # Alternative Android run command
npm run ios             # Run on iOS device/simulator
npm run web             # Run web version

# Code Quality
npm run lint            # Run ESLint

# Project Management
npm run reset-project   # Reset to blank project template
```

## Testing Guidelines

### Android Testing (Primary Platform)
- Use `npx expo run:android` for fog of war feature testing
- Test with Android emulator location simulation for GPS features
- Validate performance on Android devices/emulators
- Use Android emulator Extended Controls > Location for mock GPS data

## Environment Configuration
- **Mapbox Access Token**: Configured in app.json plugins section
- **Bundle Identifiers**: 
  - iOS: `com.deabound.Cartographer`
  - Android: `com.deabound.Cartographer`