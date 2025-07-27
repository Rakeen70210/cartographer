# Project Structure

## File-Based Routing (Expo Router)
The app uses Expo Router's file-based routing system with the `app/` directory:

```
app/
├── _layout.tsx          # Root layout with theme provider and navigation setup
├── +not-found.tsx       # 404 error page
└── (tabs)/              # Tab group layout
    ├── _layout.tsx      # Tab navigation configuration
    ├── index.tsx        # Home tab (default route)
    ├── explore.tsx      # Explore tab
    └── map.tsx          # Map tab (main feature)
```

## Component Organization

### Core Components (`components/`)
- **Themed Components**: `ThemedText.tsx`, `ThemedView.tsx` - Theme-aware UI components
- **UI Components**: `components/ui/` - Platform-specific UI elements (IconSymbol, TabBarBackground)
- **Interactive Components**: `Collapsible.tsx`, `HapticTab.tsx`, `ExternalLink.tsx`
- **Layout Components**: `ParallaxScrollView.tsx`, `HelloWave.tsx`

### Testing Pattern
Each component has a corresponding `.test.js` file in the same directory for unit tests.

## Utility Modules (`utils/`)
- **`database.ts`** - SQLite operations for locations and revealed areas
- **`logger.ts`** - Centralized logging with development/production gating

## Custom Hooks (`hooks/`)
- **`useLocationTracking.ts`** - GPS location management and background tracking
- **`useColorScheme.ts`** - Theme detection (with web-specific variant)
- **`useThemeColor.ts`** - Theme color resolution

## Fog of War Architecture (`app/(tabs)/map.tsx`)

### Core Functions
- **`createFogFeatures()`** - Generates viewport-based fog geometry with revealed area cutouts
- **`loadRevealedAreas()`** - Loads and unions revealed areas from database
- **`unionPolygons()`** - Merges multiple revealed areas into single polygon
- **Viewport detection** - Calculates current map bounds for efficient fog rendering

### Performance Optimizations
- **Viewport-based calculations**: Only processes fog for visible map area
- **Debounced updates**: Prevents excessive recalculation during map interaction
- **Polygon simplification**: Reduces complexity for large revealed area datasets
- **Error handling**: Robust fallbacks for geometric operation failures

## Configuration & Assets

### Configuration Files
- **`app.json`** - Expo configuration, plugins, and app metadata
- **`tsconfig.json`** - TypeScript configuration with path aliases (`@/*`)
- **`eslint.config.js`** - ESLint configuration with Expo presets

### Assets (`assets/`)
```
assets/
├── fonts/               # Custom fonts (SpaceMono)
└── images/              # App icons, splash screens, logos
    ├── icon.png         # App icon
    ├── adaptive-icon.png # Android adaptive icon
    ├── splash-icon.png   # Splash screen logo
    └── favicon.png       # Web favicon
```

## Platform-Specific Code
- **Android**: `android/` directory with Gradle build configuration
- **iOS**: Platform-specific components use `.ios.tsx` suffix
- **Web**: Web-specific hooks use `.web.ts` suffix

## Import Conventions
- Use `@/` path alias for imports from project root
- Relative imports for same-directory files
- Absolute imports for cross-module dependencies

## Code Organization Patterns
- **Separation of Concerns**: Database operations, logging, and location tracking are isolated in utils/hooks
- **Component Composition**: Themed components wrap base React Native components
- **Platform Abstraction**: Platform-specific implementations use file suffixes
- **Type Safety**: Comprehensive TypeScript usage with strict mode enabled