# Requirements Document

## Introduction

The current map.tsx file is a monolithic component with over 800 lines of code that handles multiple responsibilities including map rendering, fog of war calculations, location tracking, geometry validation, and UI status display. This refactoring will break it into smaller, focused components and utilities to improve maintainability, testability, and code organization while preserving all existing functionality.

## Requirements

### Requirement 1

**User Story:** As a developer, I want the map component to be broken into smaller, focused components, so that the codebase is more maintainable and easier to understand.

#### Acceptance Criteria

1. WHEN the refactoring is complete THEN the main MapScreen component SHALL be under 200 lines of code
2. WHEN the refactoring is complete THEN each extracted component SHALL have a single, clear responsibility
3. WHEN the refactoring is complete THEN all existing functionality SHALL be preserved without any behavioral changes
4. WHEN the refactoring is complete THEN the component structure SHALL follow React Native and TypeScript best practices

### Requirement 2

**User Story:** As a developer, I want geometry validation and manipulation logic separated from the UI component, so that it can be easily tested and reused.

#### Acceptance Criteria

1. WHEN geometry operations are extracted THEN they SHALL be moved to utility modules in the utils/ directory
2. WHEN geometry validation functions are extracted THEN they SHALL include comprehensive TypeScript types
3. WHEN geometry utilities are created THEN they SHALL be pure functions without side effects
4. WHEN geometry utilities are tested THEN they SHALL have unit tests covering edge cases

### Requirement 3

**User Story:** As a developer, I want fog of war calculation logic separated into its own module, so that it can be independently tested and optimized.

#### Acceptance Criteria

1. WHEN fog calculation is extracted THEN it SHALL be moved to a dedicated utility module
2. WHEN fog utilities are created THEN they SHALL handle viewport-based calculations efficiently
3. WHEN fog utilities are implemented THEN they SHALL include performance monitoring and logging
4. WHEN fog calculation errors occur THEN they SHALL be handled gracefully with appropriate fallbacks

### Requirement 4

**User Story:** As a developer, I want map styling and theming logic separated into reusable utilities, so that styling can be consistent and easily modified.

#### Acceptance Criteria

1. WHEN styling logic is extracted THEN it SHALL be moved to a dedicated styling utility
2. WHEN theme-aware styling is implemented THEN it SHALL support both light and dark themes
3. WHEN map style utilities are created THEN they SHALL handle different map styles (Dark, Light, Street, Satellite, etc.)
4. WHEN styling utilities are used THEN they SHALL provide consistent fog overlay appearance across themes

### Requirement 5

**User Story:** As a developer, I want the status display and map controls separated into their own components, so that UI elements are modular and reusable.

#### Acceptance Criteria

1. WHEN UI components are extracted THEN they SHALL be moved to the components/ directory
2. WHEN status display is separated THEN it SHALL be a standalone component with clear props interface
3. WHEN map controls are extracted THEN they SHALL handle style cycling and user interactions
4. WHEN UI components are created THEN they SHALL use ThemedText and ThemedView for consistency

### Requirement 6

**User Story:** As a developer, I want location marker rendering separated into its own component, so that marker appearance and behavior can be easily customized.

#### Acceptance Criteria

1. WHEN location marker is extracted THEN it SHALL be a reusable component in components/
2. WHEN location marker is implemented THEN it SHALL handle theme-aware styling
3. WHEN location marker is used THEN it SHALL support rotation based on heading
4. WHEN location marker is rendered THEN it SHALL include proper shadow and elevation effects

### Requirement 7

**User Story:** As a developer, I want custom hooks to manage complex state logic, so that stateful behavior is reusable and testable.

#### Acceptance Criteria

1. WHEN state management is extracted THEN custom hooks SHALL be created in the hooks/ directory
2. WHEN fog state management is extracted THEN it SHALL be handled by a dedicated hook
3. WHEN viewport management is extracted THEN it SHALL include debouncing and bounds calculation
4. WHEN custom hooks are implemented THEN they SHALL have clear interfaces and proper cleanup

### Requirement 8

**User Story:** As a developer, I want the refactored components to maintain the same performance characteristics, so that the user experience is not degraded.

#### Acceptance Criteria

1. WHEN components are refactored THEN viewport-based fog calculations SHALL remain optimized
2. WHEN geometry operations are extracted THEN they SHALL maintain the same performance profile
3. WHEN debouncing is implemented THEN it SHALL prevent excessive recalculations during map interactions
4. WHEN the refactor is complete THEN memory usage SHALL not increase significantly