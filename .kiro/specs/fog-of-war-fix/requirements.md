# Requirements Document

## Introduction

The fog of war feature in the Cartographer app is currently not working correctly. Instead of revealing areas around the user's location by cutting holes in the fog overlay, it displays a solid dark overlay over the entire map. This feature needs to be fixed to properly subtract revealed areas from the world polygon, creating visible holes in the fog where the user has been.

## Requirements

### Requirement 1

**User Story:** As a user exploring the world, I want the map to show clear, unobscured areas where I have physically been, so that I can see my exploration progress and the terrain I've discovered.

#### Acceptance Criteria

1. WHEN the user's location is tracked THEN the system SHALL create a buffer zone around that location that becomes revealed (not covered by fog)
2. WHEN multiple locations are visited THEN the system SHALL merge all revealed areas into a single continuous revealed region
3. WHEN the map is rendered THEN the system SHALL display the underlying map clearly in all revealed areas
4. WHEN the map is rendered THEN the system SHALL display fog overlay only in areas that have not been visited

### Requirement 2

**User Story:** As a user opening the app, I want to see my previously explored areas still revealed, so that my exploration progress persists between app sessions.

#### Acceptance Criteria

1. WHEN the app starts THEN the system SHALL load all previously revealed areas from the database
2. WHEN previously revealed areas exist THEN the system SHALL union them into a single revealed region
3. WHEN the map renders THEN the system SHALL display all previously revealed areas without fog overlay
4. WHEN new areas are explored THEN the system SHALL merge them with existing revealed areas

### Requirement 3

**User Story:** As a user, I want the fog of war to have a proper visual contrast with revealed areas, so that I can clearly distinguish between explored and unexplored regions.

#### Acceptance Criteria

1. WHEN areas are revealed THEN the system SHALL show the full map detail and colors in those areas
2. WHEN areas are fogged THEN the system SHALL apply a dark semi-transparent overlay that obscures but doesn't completely hide the underlying map
3. WHEN the fog boundary meets revealed areas THEN the system SHALL create a smooth visual transition
4. WHEN the user's current location is displayed THEN it SHALL be clearly visible regardless of fog state

### Requirement 4

**User Story:** As a developer testing the app, I want the fog of war to work correctly in emulator environments with simulated GPS, so that the feature can be properly tested and debugged.

#### Acceptance Criteria

1. WHEN location is simulated in an emulator THEN the system SHALL treat it as a real location for fog revealing
2. WHEN the simulated location changes THEN the system SHALL create new revealed areas around the new position
3. WHEN testing with mock locations THEN the system SHALL properly merge and display all revealed areas
4. WHEN debugging THEN the system SHALL provide clear logging about fog calculation operations

### Requirement 5

**User Story:** As a user, I want the fog of war difference operations to work reliably without errors, so that revealed areas are properly subtracted from the fog overlay.

#### Acceptance Criteria

1. WHEN revealed areas exist THEN the system SHALL successfully perform geometric difference operations between fog polygon and revealed areas
2. WHEN difference operations encounter invalid geometries THEN the system SHALL handle errors gracefully and provide fallback fog display
3. WHEN revealed areas have complex shapes THEN the system SHALL validate and sanitize geometries before difference operations
4. WHEN difference operations fail THEN the system SHALL log detailed error information and continue functioning with fallback behavior

### Requirement 6

**User Story:** As a developer, I want the fog calculation system to avoid infinite logging loops and excessive debug output, so that the app performs efficiently and logs are readable.

#### Acceptance Criteria

1. WHEN fog calculations are performed THEN the system SHALL limit debug logging to prevent performance issues
2. WHEN fog calculation errors occur THEN the system SHALL log errors once without creating infinite retry loops
3. WHEN viewport changes frequently THEN the system SHALL debounce logging to prevent log spam
4. WHEN fallback fog is used THEN the system SHALL log the fallback usage once per session, not repeatedly

### Requirement 7

**User Story:** As a user, I want the fog calculation to work correctly in Android emulator environments, so that I can test and use the app during development.

#### Acceptance Criteria

1. WHEN running in Android emulator THEN the fog calculation SHALL work without throwing "All fog calculations failed" errors
2. WHEN using simulated GPS locations THEN the fog system SHALL properly calculate and display revealed areas
3. WHEN the map loads initially THEN the fog system SHALL initialize without errors and display appropriate fog coverage
4. WHEN no revealed areas exist THEN the fog system SHALL display viewport-based fog without errors