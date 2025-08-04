/**
 * Utility functions for formatting statistics data for display
 */

/**
 * Formats distance values with appropriate units and precision
 */
export const formatDistance = (miles: number, kilometers: number): {
  primary: string;
  secondary: string;
  displayValue: string;
} => {
  // Use miles as primary for US users, km for others
  // For now, defaulting to miles as primary
  const primaryValue = miles >= 1 ? `${miles.toFixed(1)} mi` : `${(miles * 5280).toFixed(0)} ft`;
  const secondaryValue = kilometers >= 1 ? `${kilometers.toFixed(1)} km` : `${(kilometers * 1000).toFixed(0)} m`;
  
  return {
    primary: primaryValue,
    secondary: secondaryValue,
    displayValue: primaryValue,
  };
};

/**
 * Formats percentage values with appropriate precision
 */
export const formatPercentage = (percentage: number): {
  displayValue: string;
  precision: 'high' | 'medium' | 'low';
} => {
  let displayValue: string;
  let precision: 'high' | 'medium' | 'low';
  
  if (percentage < 0.001) {
    displayValue = '<0.001%';
    precision = 'high';
  } else if (percentage < 0.01) {
    displayValue = `${percentage.toFixed(4)}%`;
    precision = 'high';
  } else if (percentage < 1) {
    displayValue = `${percentage.toFixed(3)}%`;
    precision = 'medium';
  } else if (percentage < 10) {
    displayValue = `${percentage.toFixed(2)}%`;
    precision = 'medium';
  } else {
    displayValue = `${percentage.toFixed(1)}%`;
    precision = 'low';
  }
  
  return { displayValue, precision };
};

/**
 * Formats area values with appropriate units
 */
export const formatArea = (areaKm2: number): string => {
  if (areaKm2 < 1) {
    return `${(areaKm2 * 1000000).toFixed(0)} m²`;
  } else if (areaKm2 < 1000) {
    return `${areaKm2.toFixed(1)} km²`;
  } else {
    return `${(areaKm2 / 1000).toFixed(1)}k km²`;
  }
};

/**
 * Formats count values with appropriate formatting
 */
export const formatCount = (count: number): string => {
  if (count === 0) return '0';
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
  return `${(count / 1000000).toFixed(1)}M`;
};

/**
 * Formats remaining count with contextual messaging
 */
export const formatRemaining = (remaining: number, total: number): string => {
  if (remaining === total) return 'None visited yet';
  if (remaining === 0) return 'All visited!';
  
  const percentage = ((total - remaining) / total) * 100;
  if (percentage < 1) {
    return `${formatCount(remaining)} remaining`;
  } else if (percentage > 99) {
    return `${formatCount(remaining)} left`;
  } else {
    return `${formatCount(remaining)} remaining`;
  }
};

/**
 * Formats timestamp for display
 */
export const formatTimestamp = (timestamp: number): {
  time: string;
  date: string;
  relative: string;
} => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  let relative: string;
  if (diffMinutes < 1) {
    relative = 'Just now';
  } else if (diffMinutes < 60) {
    relative = `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    relative = `${diffHours}h ago`;
  } else if (diffDays < 7) {
    relative = `${diffDays}d ago`;
  } else {
    relative = date.toLocaleDateString();
  }
  
  return {
    time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date: date.toLocaleDateString(),
    relative,
  };
};

/**
 * Gets appropriate icon for statistic type
 */
export const getStatisticIcon = (type: string): string => {
  const icons: Record<string, string> = {
    distance: '🚶‍♂️',
    worldExploration: '🌍',
    countries: '🏳️',
    states: '🗺️',
    cities: '🏙️',
    lastUpdated: '🕒',
    areas: '📍',
    locations: '📌',
  };
  
  return icons[type] || '📊';
};

/**
 * Determines if a statistic should show a progress bar
 */
export const shouldShowProgress = (type: string, percentage?: number): boolean => {
  if (type === 'worldExploration' && percentage !== undefined) {
    return percentage > 0;
  }
  return false;
};

/**
 * Gets color scheme for different statistic types
 */
export const getStatisticColors = (type: string): {
  primary: string;
  secondary: string;
  accent: string;
} => {
  const colorSchemes: Record<string, { primary: string; secondary: string; accent: string }> = {
    distance: {
      primary: '#10B981', // Green
      secondary: '#34D399',
      accent: '#059669',
    },
    worldExploration: {
      primary: '#3B82F6', // Blue
      secondary: '#60A5FA',
      accent: '#2563EB',
    },
    countries: {
      primary: '#8B5CF6', // Purple
      secondary: '#A78BFA',
      accent: '#7C3AED',
    },
    states: {
      primary: '#F59E0B', // Amber
      secondary: '#FBBF24',
      accent: '#D97706',
    },
    cities: {
      primary: '#EF4444', // Red
      secondary: '#F87171',
      accent: '#DC2626',
    },
    default: {
      primary: '#6B7280', // Gray
      secondary: '#9CA3AF',
      accent: '#4B5563',
    },
  };
  
  return colorSchemes[type] || colorSchemes.default;
};