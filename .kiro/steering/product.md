---
inclusion: always
---

# Product Overview

**Cartographer** is a React Native mobile application that creates a "fog of war" mapping experience. Users explore the real world and gradually reveal areas on a map as they physically visit locations.

## Core Functionality

### Location-Based Exploration
- GPS tracking reveals map areas as users physically visit locations
- Each visited location creates a circular buffer zone (revealed area) around the user's position
- Revealed areas persist between app sessions using SQLite storage
- Background location tracking continues when app is not active

### Fog of War Mechanics
- Dark overlay (fog) covers unexplored map areas
- Fog is "burned away" as users visit new locations
- Viewport-based fog rendering for performance optimization
- Real-time fog updates as users move and explore

## User Experience Principles

- **Discovery-driven**: Encourage physical exploration of real-world locations
- **Progressive revelation**: Map areas unlock gradually through movement
- **Persistent progress**: Exploration history is permanently saved
- **Real-time feedback**: Immediate visual response to location changes

## Technical Architecture

### Core Technologies
- **Mapbox**: Primary mapping engine for visualization and viewport detection
- **Turf.js**: Geospatial operations (buffer, union, difference, bbox calculations)
- **SQLite**: Local persistence for locations and revealed areas
- **Expo Location**: GPS tracking and background task management

### Performance Requirements
- **Viewport-based calculations**: Only process fog for visible map area
- **Debounced updates**: Prevent excessive recalculation during map interaction
- **Polygon simplification**: Reduce complexity for large datasets
- **Memory efficiency**: Optimize for global-scale exploration without degradation

## Development Guidelines

### Feature Implementation
- Always consider performance impact at global scale
- Implement viewport-based optimizations for map-related features
- Use geometric operations from Turf.js for spatial calculations
- Ensure all location data persists to SQLite database

### Testing Approach
- Primary testing on Android platform using `npx expo run:android`
- Use Android emulator Extended Controls > Location for GPS simulation
- Test fog rendering performance with large revealed area datasets
- Validate background location tracking functionality

### Code Patterns
- Separate geospatial logic into utility modules
- Use custom hooks for location and map state management
- Implement error handling for geometric operations
- Follow viewport-based rendering patterns for map features