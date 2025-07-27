# Product Overview

**Cartographer** is a React Native mobile application that creates a "fog of war" mapping experience. Users explore the real world and gradually reveal areas on a map as they physically visit locations.

## Core Features

- **Location-based exploration**: Uses GPS tracking to reveal map areas as users move through the world
- **Persistent mapping**: Revealed areas are stored locally using SQLite and persist between app sessions  
- **Real-time visualization**: Interactive map with Mapbox showing current location and explored regions
- **Background tracking**: Continues location tracking when app is backgrounded
- **Cross-platform**: Built with Expo for iOS, Android, and web deployment

## User Experience

The app presents users with a dark map overlay (fog of war) that gets "burned away" as they physically visit locations. Each visited area creates a buffer zone of revealed terrain, encouraging exploration and discovery of new places.

## Technical Approach

- Uses Mapbox for mapping, visualization, and viewport detection
- Implements viewport-based fog rendering for optimal performance at global scale
- Uses Turf.js for geospatial operations: area calculations, polygon unions, and geometric difference
- Stores location data and revealed areas in local SQLite database with efficient querying
- Leverages Expo's location services for precise GPS tracking and background updates
- Dynamic fog updates with debounced viewport change detection for smooth user experience

## Performance Considerations

- **Viewport-based fog**: Only calculates fog geometry for visible map area, not entire world
- **Scalable architecture**: Performance doesn't degrade with extensive global exploration
- **Memory efficiency**: Reduced polygon complexity through viewport clipping and simplification
- **Smooth rendering**: Debounced updates prevent excessive recalculation during map interaction