---
inclusion: always
---

# Project Structure & Architecture

## File Organization

### Directory Structure
- `app/` - Expo Router file-based routing
  - `(tabs)/` - Tab navigation with `_layout.tsx`
  - `map.tsx` - Primary fog-of-war map feature
- `components/` - Reusable UI components
  - `ui/` - Base UI components
  - Use `ThemedText`, `ThemedView` for consistent styling
- `utils/` - Business logic and utilities
  - `database.ts` - ALL SQLite operations (required entry point)
  - Geospatial utilities with descriptive names
- `hooks/` - Custom React hooks for stateful logic
- `types/` - TypeScript type definitions

### File Naming Conventions
- Platform-specific: `.ios.tsx`, `.web.ts` suffixes
- Tests: `.test.js` alongside source files
- Components: PascalCase (e.g., `FogOverlay.tsx`)
- Utilities: camelCase (e.g., `distanceCalculator.ts`)

## Import Rules (CRITICAL)

**Always use `@/` path aliases - never relative imports across directories**

```typescript
// ✅ Correct
import { database } from '@/utils/database';
import { ThemedText } from '@/components/ThemedText';
import { useLocationTracking } from '@/hooks/useLocationTracking';

// ❌ Never do this
import { database } from '../../utils/database';
```

## Architecture Patterns

### Data Flow (MANDATORY)
1. **Database-first**: All persistent data through `@/utils/database.ts`
2. **Hook abstraction**: Complex state logic in custom hooks
3. **Component separation**: UI components only render, logic in hooks/utils
4. **No direct SQL**: Use database utility functions, never raw queries in components

### Performance Requirements
- **Viewport-based calculations**: Only process visible map areas
- **Debouncing**: 300ms for map interactions, user input
- **Memory cleanup**: Remove listeners in useEffect cleanup
- **Polygon simplification**: For large geospatial datasets

### Error Handling Patterns
```typescript
// Always validate Turf.js operations
const result = turf.difference(viewport, revealedAreas);
if (!result) {
  return fallbackGeometry; // Never return null/undefined
}
```

## Code Standards

### TypeScript (STRICT MODE)
- All code must pass strict TypeScript checks
- Define interfaces for component props and data structures
- Use generic types for reusable utilities

### Component Patterns
- Use `ThemedText`/`ThemedView` instead of base React Native components
- Define TypeScript interfaces for all props
- Prefer composition over prop drilling
- Keep components focused on rendering only

### Function Naming
Use descriptive, action-oriented names:
- `createFogFeatures()` not `fogFeatures()`
- `loadRevealedAreas()` not `getAreas()`
- `unionPolygons()` not `union()`

### Platform Handling
- Prefer file suffixes (`.ios.tsx`) over runtime platform checks
- Keep shared logic in base files without suffixes
- Use conditional imports for platform-specific modules