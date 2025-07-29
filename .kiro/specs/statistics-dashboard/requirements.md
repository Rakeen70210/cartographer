# Requirements Document

## Introduction

The Statistics Dashboard feature will add a new tab to the Cartographer application that displays key motivational statistics about the user's exploration journey. This dashboard will provide users with meaningful metrics that encourage continued exploration by showing their progress in discovering the world through the fog of war mechanic.

## Requirements

### Requirement 1

**User Story:** As a Cartographer user, I want to see my total distance traveled, so that I can track my exploration progress and feel motivated by my achievements.

#### Acceptance Criteria

1. WHEN the user opens the Statistics tab THEN the system SHALL display the total distance traveled in both miles and kilometers
2. WHEN the user has no location data THEN the system SHALL display "0 miles (0 km)" as the default value
3. WHEN calculating distance THEN the system SHALL use the haversine formula to calculate distances between consecutive GPS points
4. WHEN displaying distance THEN the system SHALL format numbers with appropriate precision (e.g., 12.5 miles, 1,234.7 km)

### Requirement 2

**User Story:** As a Cartographer user, I want to see hierarchical exploration percentages (world, countries, states/provinces, cities), so that I can understand my exploration progress at different geographic scales.

#### Acceptance Criteria

1. WHEN the user opens the Statistics tab THEN the system SHALL display the percentage of world explored as a decimal percentage (e.g., 0.001%)
2. WHEN calculating world exploration percentage THEN the system SHALL use the total area of revealed polygons divided by Earth's total surface area
3. WHEN the user has explored areas in countries THEN the system SHALL display percentage explored for each country visited
4. WHEN the user has explored areas in states/provinces THEN the system SHALL display percentage explored for each state/province within each country
5. WHEN the user has explored areas in cities THEN the system SHALL display percentage explored for each city within each state/province
6. WHEN the user has no revealed areas THEN the system SHALL display "0.000%" for all geographic levels
7. WHEN displaying percentages THEN the system SHALL format to 3 decimal places for world level and 1-2 decimal places for smaller geographic areas
8. WHEN displaying hierarchical data THEN the system SHALL organize it in a collapsible tree structure (World > Country > State/Province > City)
9. IF geographic boundary data is unavailable THEN the system SHALL gracefully handle missing information and display available data only

### Requirement 3

**User Story:** As a Cartographer user, I want to see how many unique geographic regions I have visited and how many remain to be explored, so that I can track my exploration achievements and understand the scope of future exploration opportunities.

#### Acceptance Criteria

1. WHEN the user opens the Statistics tab THEN the system SHALL display the count of unique countries visited
2. WHEN the user opens the Statistics tab THEN the system SHALL display the count of unique states/provinces visited
3. WHEN the user opens the Statistics tab THEN the system SHALL display the count of unique cities visited
4. WHEN the user opens the Statistics tab THEN the system SHALL display the count of countries remaining to be explored (total countries - visited countries)
5. WHEN the user opens the Statistics tab THEN the system SHALL display the count of states/provinces remaining to be explored in visited countries
6. WHEN the user opens the Statistics tab THEN the system SHALL display the count of cities remaining to be explored in visited states/provinces
7. WHEN determining geographic regions visited THEN the system SHALL use reverse geocoding or geospatial boundary checking against GPS coordinates
8. WHEN calculating remaining counts THEN the system SHALL use authoritative geographic databases or APIs to determine total counts
9. WHEN the user has no location data THEN the system SHALL display "0" for visited counts and total available counts for remaining
10. WHEN displaying region counts THEN the system SHALL use proper pluralization (e.g., "1 country", "5 countries", "1 state", "3 cities")
11. WHEN displaying counts THEN the system SHALL show both visited and remaining counts in a clear format (e.g., "5 of 195 countries visited, 190 remaining")
12. IF geographic region detection fails for some locations THEN the system SHALL still display the count of successfully identified regions
13. IF total count data is unavailable THEN the system SHALL display visited counts only with appropriate messaging

### Requirement 4

**User Story:** As a Cartographer user, I want the statistics dashboard to have an elegant and motivational design with expandable geographic breakdowns, so that viewing my progress feels rewarding and I can explore my achievements at different levels of detail.

#### Acceptance Criteria

1. WHEN the user opens the Statistics tab THEN the system SHALL display key statistics in a clean, card-based layout at the top
2. WHEN displaying hierarchical exploration data THEN the system SHALL use an expandable tree view with smooth animations
3. WHEN displaying statistics THEN the system SHALL use consistent theming with the rest of the application
4. WHEN showing each statistic THEN the system SHALL include appropriate icons and visual hierarchy
5. WHEN statistics are loading THEN the system SHALL show loading indicators or skeleton screens
6. WHEN displaying large numbers THEN the system SHALL use appropriate formatting and spacing for readability
7. WHEN showing geographic breakdowns THEN the system SHALL use indentation and visual cues to show hierarchy levels
8. WHEN percentages are very small THEN the system SHALL use progress bars or visual indicators to make progress feel meaningful

### Requirement 5

**User Story:** As a Cartographer user, I want the statistics to update automatically when I explore new areas, so that my progress is always current and accurate.

#### Acceptance Criteria

1. WHEN the user visits the Statistics tab after exploring new areas THEN the system SHALL display updated statistics
2. WHEN the app is running and new location data is recorded THEN the system SHALL recalculate statistics in the background
3. WHEN statistics are being recalculated THEN the system SHALL not block the user interface
4. WHEN returning to the Statistics tab THEN the system SHALL refresh data if it has become stale
5. IF real-time updates are not feasible THEN the system SHALL update statistics when the tab becomes active

### Requirement 6

**User Story:** As a Cartographer user, I want the statistics dashboard to work offline, so that I can view my progress even without an internet connection.

#### Acceptance Criteria

1. WHEN the user opens the Statistics tab without internet connection THEN the system SHALL display statistics based on locally stored data
2. WHEN calculating statistics THEN the system SHALL use only data available in the local SQLite database
3. WHEN country detection requires internet THEN the system SHALL gracefully handle offline scenarios
4. WHEN offline THEN the system SHALL indicate if certain statistics may be incomplete due to connectivity
5. WHEN connection is restored THEN the system SHALL update any statistics that require online services