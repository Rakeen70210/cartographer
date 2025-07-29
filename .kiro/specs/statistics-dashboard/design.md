# Design Document

## Overview

The Statistics Dashboard will be implemented as a new tab in the existing Cartographer application, providing users with comprehensive exploration metrics. The dashboard will display key statistics including distance traveled, world exploration percentages at multiple geographic levels, and counts of unique regions visited. The design emphasizes motivation through clear visual hierarchy, elegant presentation, and meaningful progress indicators.

## Architecture

### Component Structure
```
app/(tabs)/statistics.tsx          # Main statistics screen component
├── components/StatisticsCard.tsx  # Reusable card component for individual stats
├── components/HierarchicalView.tsx # Expandable tree view for geographic breakdowns
├── components/ProgressIndicator.tsx # Visual progress bars and indicators
├── utils/statisticsCalculator.ts  # Core calculation logic
├── utils/geocodingService.ts      # Geographic boundary and reverse geocoding
└── hooks/useStatistics.ts         # Custom hook for statistics data management
```

### Data Flow Architecture
1. **Data Sources**: SQLite database (locations, revealed_areas tables)
2. **Processing Layer**: Statistics calculator utilities
3. **State Management**: React hooks with local state and caching
4. **Presentation Layer**: Themed components with responsive design
5. **Background Updates**: Automatic recalculation on data changes

## Components and Interfaces

### Core Data Types
```typescript
interface StatisticsData {
  totalDistance: {
    miles: number;
    kilometers: number;
  };
  worldExploration: {
    percentage: number;
    totalArea: number; // in square kilometers
    exploredArea: number; // in square kilometers
  };
  uniqueRegions: {
    countries: number;
    states: number;
    cities: number;
  };
  remainingRegions: {
    countries: number;
    states: number;
    cities: number;
  };
  hierarchicalBreakdown: GeographicHierarchy[];
}

interface GeographicHierarchy {
  type: 'country' | 'state' | 'city';
  name: string;
  code?: string; // ISO codes for countries/states
  explorationPercentage: number;
  totalArea?: number;
  exploredArea?: number;
  children?: GeographicHierarchy[];
  isExpanded?: boolean;
}
```

### StatisticsCard Component
```typescript
interface StatisticsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  progressPercentage?: number;
  isLoading?: boolean;
  onPress?: () => void;
}
```

### HierarchicalView Component
```typescript
interface HierarchicalViewProps {
  data: GeographicHierarchy[];
  onToggleExpand: (item: GeographicHierarchy) => void;
  maxDepth?: number;
  showProgressBars?: boolean;
}
```

### Statistics Calculator Service
```typescript
class StatisticsCalculator {
  // Distance calculation using haversine formula
  static calculateTotalDistance(locations: Location[]): Promise<{miles: number, kilometers: number}>;
  
  // World exploration percentage using Turf.js area calculations
  static calculateWorldExploration(revealedAreas: RevealedArea[]): Promise<{percentage: number, exploredArea: number}>;
  
  // Geographic region counting with reverse geocoding
  static calculateUniqueRegions(locations: Location[]): Promise<{countries: number, states: number, cities: number}>;
  
  // Hierarchical breakdown with area calculations per region
  static calculateHierarchicalBreakdown(locations: Location[], revealedAreas: RevealedArea[]): Promise<GeographicHierarchy[]>;
  
  // Remaining region calculations
  static calculateRemainingRegions(visitedRegions: {countries: number, states: number, cities: number}): Promise<{countries: number, states: number, cities: number}>;
}
```

### Geocoding Service
```typescript
class GeocodingService {
  // Reverse geocoding for location classification
  static reverseGeocode(latitude: number, longitude: number): Promise<{country: string, state: string, city: string}>;
  
  // Geographic boundary data retrieval
  static getRegionBoundaries(regionType: 'country' | 'state' | 'city', regionName: string): Promise<Polygon>;
  
  // Total region counts from authoritative sources
  static getTotalRegionCounts(): Promise<{countries: number, states: number, cities: number}>;
  
  // Offline fallback with cached boundary data
  static getCachedRegionData(coordinates: [number, number]): {country?: string, state?: string, city?: string};
}
```

## Data Models

### Database Schema Extensions
The existing SQLite database will be extended with additional tables for caching geographic data:

```sql
-- Cache for reverse geocoding results
CREATE TABLE IF NOT EXISTS location_geocoding (
  id INTEGER PRIMARY KEY,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  country TEXT,
  state TEXT,
  city TEXT,
  timestamp INTEGER NOT NULL,
  UNIQUE(latitude, longitude)
);

-- Cache for region boundary data
CREATE TABLE IF NOT EXISTS region_boundaries (
  id INTEGER PRIMARY KEY,
  region_type TEXT NOT NULL, -- 'country', 'state', 'city'
  region_name TEXT NOT NULL,
  boundary_geojson TEXT NOT NULL,
  area_km2 REAL,
  timestamp INTEGER NOT NULL,
  UNIQUE(region_type, region_name)
);

-- Statistics calculation cache
CREATE TABLE IF NOT EXISTS statistics_cache (
  id INTEGER PRIMARY KEY,
  cache_key TEXT UNIQUE NOT NULL,
  cache_value TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);
```

### Geographic Data Structure
```typescript
interface LocationWithGeography {
  id: number;
  latitude: number;
  longitude: number;
  timestamp: number;
  country?: string;
  countryCode?: string;
  state?: string;
  stateCode?: string;
  city?: string;
  isGeocoded: boolean;
}
```

## Error Handling

### Graceful Degradation Strategy
1. **Offline Mode**: Display cached statistics with offline indicators
2. **Partial Data**: Show available statistics even if some calculations fail
3. **Loading States**: Skeleton screens and progressive loading
4. **Error Recovery**: Retry mechanisms for failed geocoding requests
5. **Fallback Values**: Default to basic calculations if advanced features fail

### Error Scenarios and Responses
```typescript
enum StatisticsError {
  GEOCODING_FAILED = 'geocoding_failed',
  CALCULATION_ERROR = 'calculation_error',
  DATABASE_ERROR = 'database_error',
  NETWORK_ERROR = 'network_error'
}

interface ErrorHandlingStrategy {
  [StatisticsError.GEOCODING_FAILED]: () => void; // Use cached data or skip geographic breakdown
  [StatisticsError.CALCULATION_ERROR]: () => void; // Display partial results with error message
  [StatisticsError.DATABASE_ERROR]: () => void; // Show error state with retry option
  [StatisticsError.NETWORK_ERROR]: () => void; // Enable offline mode
}
```

## Testing Strategy

### Unit Testing
- **Statistics Calculator**: Test distance calculations, area calculations, and geographic region counting
- **Geocoding Service**: Mock API responses and test offline fallbacks
- **Database Operations**: Test CRUD operations for new tables and caching logic
- **Component Logic**: Test state management and user interactions

### Integration Testing
- **End-to-End Statistics Flow**: Test complete statistics calculation pipeline
- **Database Integration**: Test statistics calculation with real location data
- **Theme Integration**: Test component rendering in light/dark themes
- **Performance Testing**: Test with large datasets and complex geographic hierarchies

### Performance Testing
- **Large Dataset Handling**: Test with thousands of location points
- **Memory Usage**: Monitor memory consumption during complex calculations
- **Rendering Performance**: Test hierarchical view with deep nesting
- **Background Processing**: Test statistics updates without blocking UI

### Test Data Scenarios
```typescript
const testScenarios = {
  emptyData: [], // No locations or revealed areas
  singleLocation: [/* one location */], // Minimal data set
  multipleCountries: [/* locations across countries */], // International travel
  denseExploration: [/* many locations in small area */], // Local exploration
  sparseExploration: [/* few locations across large area */], // Long-distance travel
  complexHierarchy: [/* locations with full geographic hierarchy */] // Complete breakdown
};
```

## UI/UX Design Specifications

### Layout Structure
```
┌─────────────────────────────────────┐
│ Statistics Dashboard                │
├─────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│ │Distance │ │ World % │ │Countries│ │
│ │Traveled │ │Explored │ │Visited  │ │
│ └─────────┘ └─────────┘ └─────────┘ │
├─────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│ │ States  │ │ Cities  │ │Remaining│ │
│ │Visited  │ │Visited  │ │Regions  │ │
│ └─────────┘ └─────────┘ └─────────┘ │
├─────────────────────────────────────┤
│ Geographic Breakdown                │
│ ▼ United States (2.5%)              │
│   ▼ California (15.2%)              │
│     • San Francisco (45.8%)         │
│     • Los Angeles (12.3%)           │
│   ▶ New York (0.8%)                 │
│ ▶ Canada (0.1%)                     │
└─────────────────────────────────────┘
```

### Visual Design Elements

#### Color Scheme (Theme-Aware)
```typescript
const statisticsTheme = {
  light: {
    cardBackground: '#FFFFFF',
    cardBorder: '#E5E7EB',
    primaryText: '#111827',
    secondaryText: '#6B7280',
    accentColor: '#0a7ea4',
    progressBackground: '#F3F4F6',
    progressFill: '#10B981',
    warningColor: '#F59E0B',
    errorColor: '#EF4444'
  },
  dark: {
    cardBackground: '#1F2937',
    cardBorder: '#374151',
    primaryText: '#F9FAFB',
    secondaryText: '#D1D5DB',
    accentColor: '#60A5FA',
    progressBackground: '#374151',
    progressFill: '#34D399',
    warningColor: '#FBBF24',
    errorColor: '#F87171'
  }
};
```

#### Typography Hierarchy
- **Card Titles**: ThemedText type="subtitle" (20px, bold)
- **Primary Values**: ThemedText type="title" (32px, bold) 
- **Secondary Values**: ThemedText type="defaultSemiBold" (16px, semibold)
- **Geographic Names**: ThemedText type="default" (16px, regular)
- **Percentages**: ThemedText type="defaultSemiBold" with accent color

#### Card Design Specifications
```typescript
const cardStyles = {
  container: {
    backgroundColor: 'cardBackground',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 8,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  icon: {
    marginRight: 8,
    size: 24
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginTop: 8
  }
};
```

### Responsive Design
- **Phone Portrait**: 2-column card grid
- **Phone Landscape**: 3-column card grid  
- **Tablet**: 4-column card grid with expanded hierarchical view
- **Minimum Touch Targets**: 44px for all interactive elements
- **Safe Area Handling**: Proper insets for notched devices

### Accessibility Features
- **Screen Reader Support**: Comprehensive labels and descriptions
- **High Contrast**: Enhanced contrast ratios for text and UI elements
- **Dynamic Type**: Support for system font size preferences
- **Voice Control**: Proper accessibility identifiers
- **Reduced Motion**: Respect system animation preferences

### Loading and Empty States
```typescript
const uiStates = {
  loading: {
    skeleton: true,
    shimmerEffect: true,
    progressIndicator: true
  },
  empty: {
    illustration: 'exploration-start',
    title: 'Start Your Journey',
    subtitle: 'Begin exploring to see your statistics',
    actionButton: 'Go to Map'
  },
  error: {
    illustration: 'error-state',
    title: 'Unable to Load Statistics',
    subtitle: 'Check your connection and try again',
    actionButton: 'Retry'
  },
  offline: {
    banner: 'Offline Mode - Some data may be outdated',
    reducedFunctionality: true
  }
};
```

## Performance Optimizations

### Calculation Efficiency
- **Incremental Updates**: Only recalculate changed statistics
- **Background Processing**: Use Web Workers for heavy calculations
- **Caching Strategy**: Cache expensive calculations with TTL
- **Debounced Updates**: Prevent excessive recalculation during rapid changes

### Memory Management
- **Lazy Loading**: Load hierarchical data on demand
- **Data Pagination**: Limit initial data load for large datasets
- **Garbage Collection**: Proper cleanup of calculation results
- **Memory Monitoring**: Track memory usage during complex operations

### Rendering Optimizations
- **Virtual Scrolling**: For large hierarchical lists
- **Memoization**: React.memo for expensive components
- **Optimized Re-renders**: Minimize unnecessary component updates
- **Progressive Enhancement**: Load basic stats first, then detailed breakdowns