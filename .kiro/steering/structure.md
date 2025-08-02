---
inclusion: always
---

# Project Structure & Architecture Patterns

## File Organization Rules

### Expo Router Structure
- **Route files**: Place in `app/` directory following file-based routing
- **Tab navigation**: Use `(tabs)/` group with `_layout.tsx` for configuration
- **Main feature**: Map functionality lives in `app/(tabs)/map.tsx`

### Component Placement
- **Themed components**: Use `ThemedText`, `ThemedView` from `components/` for consistent styling
- **Platform-specific**: Use `.ios.tsx` suffix for iOS-specific implementations
- **UI components**: Place reusable UI in `components/ui/`
- **Testing**: Create `.test.js` files alongside components in same directory

### Utility Organization
- **Database operations**: Use `utils/database.ts` for all SQLite interactions
- **Geospatial logic**: Place in `utils/` with descriptive names (e.g., `distanceCalculator.ts`)
- **Logging**: Use `utils/logger.ts` for all console output with dev/prod gating
- **Custom hooks**: Place in `hooks/` directory for reusable stateful logic

## Import Conventions (REQUIRED)
- **Path aliases**: Always use `@/` for imports from project root
- **Relative imports**: Use `./` for same-directory files only
- **Cross-module**: Use absolute `@/` paths for utils, hooks, components

```typescript
// Correct
import { database } from '@/utils/database';
import { ThemedText } from '@/components/ThemedText';
import { useLocationTracking } from '@/hooks/useLocationTracking';

// Incorrect
import { database } from '../../utils/database';
```

## Architecture Patterns

### Fog of War Implementation
- **Viewport-based**: Always limit calculations to visible map area
- **Function naming**: Use descriptive names (`createFogFeatures`, `loadRevealedAreas`, `unionPolygons`)
- **Performance**: Implement debouncing for map interactions
- **Error handling**: Provide fallbacks for geometric operations

### Data Flow Patterns
- **Database first**: All persistent data must go through `utils/database.ts`
- **Hook abstraction**: Wrap complex state logic in custom hooks
- **Component separation**: Keep UI components focused on rendering, logic in hooks/utils

### Platform Handling
- **File suffixes**: Use `.ios.tsx`, `.web.ts` for platform-specific code
- **Conditional logic**: Prefer file suffixes over runtime platform checks
- **Shared logic**: Keep common functionality in base files without suffixes

## Code Style Requirements

### TypeScript Usage
- **Strict mode**: All code must pass TypeScript strict checks
- **Type definitions**: Create interfaces for complex data structures
- **Generic types**: Use for reusable utility functions

### Component Patterns
- **Themed components**: Always use `ThemedText`/`ThemedView` instead of base React Native components
- **Props interfaces**: Define TypeScript interfaces for all component props
- **Composition**: Prefer component composition over complex prop drilling

### Performance Guidelines
- **Viewport optimization**: Only process data for visible map areas
- **Debouncing**: Use for expensive operations triggered by user interaction
- **Polygon simplification**: Implement for large geospatial datasets
- **Memory management**: Clean up listeners and subscriptions in useEffect cleanup