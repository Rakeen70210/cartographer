# Implementation Plan

- [x] 1. Extract geometry validation and operations utilities
  - Create `utils/geometryValidation.ts` with validation functions and TypeScript types
  - Create `utils/geometryOperations.ts` with Turf.js wrapper functions for union, difference, and sanitization
  - Add comprehensive error handling and logging to geometry operations
  - Write unit tests for geometry validation and operations with edge cases
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2. Extract fog calculation logic into dedicated utility
  - Create `utils/fogCalculation.ts` with viewport-based fog calculation functions
  - Implement performance monitoring and complexity metrics for fog operations
  - Add progressive fallback strategies for fog calculation errors
  - Create fog calculation result types and interfaces
  - Write unit tests for fog calculation with various scenarios
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Create map styling utilities
  - Create `utils/mapStyling.ts` with theme-aware fog styling functions
  - Implement map style name mapping and cycling logic
  - Add location marker styling utilities with theme support
  - Create TypeScript interfaces for styling configurations
  - Write unit tests for styling utilities across different themes
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 4. Create custom hooks for state management
- [x] 4.1 Implement useFogCalculation hook
  - Create `hooks/useFogCalculation.ts` for fog state management
  - Implement debounced fog updates and viewport-based calculations
  - Add integration with geometry and fog calculation utilities
  - Include proper cleanup and memory management
  - Write unit tests for fog calculation hook behavior
  - _Requirements: 7.1, 7.2, 8.1, 8.4_

- [x] 4.2 Implement useMapViewport hook
  - Create `hooks/useMapViewport.ts` for viewport bounds management
  - Implement debounced viewport updates and bounds calculation
  - Add viewport change state management to prevent flickering
  - Include proper timeout cleanup and error handling
  - Write unit tests for viewport management hook
  - _Requirements: 7.1, 7.3, 8.2, 8.3_

- [x] 4.3 Implement useMapStyling hook
  - Create `hooks/useMapStyling.ts` for theme-aware styling management
  - Integrate with map styling utilities and color scheme detection
  - Implement map style cycling and fog styling coordination
  - Add proper TypeScript interfaces for hook return values
  - Write unit tests for styling hook with different themes
  - _Requirements: 7.1, 7.4, 4.1, 4.2_

- [x] 5. Extract UI components
- [x] 5.1 Create MapLocationMarker component
  - Create `components/MapLocationMarker.tsx` with location marker rendering
  - Implement theme-aware styling and heading-based rotation
  - Add proper shadow and elevation effects for marker visibility
  - Include TypeScript props interface and proper error handling
  - Write component tests for different location states and themes
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 5.1, 5.4_

- [x] 5.2 Create FogOverlay component
  - Create `components/FogOverlay.tsx` for fog rendering
  - Implement fog layer and edge layer rendering with styling props
  - Add error handling for invalid fog geometries
  - Include proper TypeScript interfaces for fog overlay props
  - Write component tests for various fog geometries and styling
  - _Requirements: 5.1, 5.4, 3.4_

- [x] 5.3 Create MapStatusDisplay component
  - Create `components/MapStatusDisplay.tsx` for status and controls UI
  - Implement location status display and map style information
  - Add map style cycling controls and user interaction handling
  - Use ThemedText and ThemedView for consistent styling
  - Write component tests for different status states and interactions
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 6. Refactor main MapScreen component
  - Update `app/(tabs)/map.tsx` to use extracted hooks and components
  - Remove geometry validation, fog calculation, and styling logic from main component
  - Integrate custom hooks for state management and extracted UI components
  - Ensure proper prop passing and component coordination
  - Maintain all existing functionality and map interaction behavior
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 8.1, 8.4_

- [x] 7. Add comprehensive testing and performance monitoring
  - Create integration tests for refactored map component functionality
  - Add performance benchmarks for geometry operations and fog calculations
  - Implement error scenario testing with fallback strategies
  - Create memory usage monitoring for component lifecycle
  - Add regression tests to ensure no behavioral changes
  - _Requirements: 2.4, 3.3, 8.1, 8.2, 8.3, 8.4_

- [x] 8. Update imports and clean up legacy code
- [x] 8.1 Optimize main MapScreen component to meet size requirements
  - Refactor MapScreen component to be under 200 lines as specified in requirements
  - Extract remaining inline functions and logic to utility modules or hooks
  - Simplify viewport bounds handling and location processing logic
  - Remove duplicate code and consolidate similar functionality
  - _Requirements: 1.1, 1.2_

- [x] 8.2 Add comprehensive JSDoc documentation
  - Add proper JSDoc comments for all utility functions in geometryValidation.ts
  - Add JSDoc documentation for all functions in fogCalculation.ts and mapStyling.ts
  - Document all custom hook interfaces and return values
  - Add JSDoc comments for all extracted component props and methods
  - _Requirements: 1.4_

- [x] 8.3 Verify import consistency and cleanup
  - Ensure all import statements use @/ path aliases consistently
  - Remove any unused imports from the main MapScreen component
  - Verify proper TypeScript types are used throughout the refactored code
  - Clean up any remaining legacy code or commented-out sections
  - _Requirements: 1.3, 1.4_