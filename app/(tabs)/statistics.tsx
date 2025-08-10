import React, { useCallback } from 'react';
import {
    AccessibilityInfo,
    Animated,
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HierarchicalView } from '@/components/HierarchicalView';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { StatisticsCard } from '@/components/StatisticsCard';
import { StatisticsErrorBoundary } from '@/components/StatisticsErrorBoundary';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useOfflineStatistics } from '@/hooks/useOfflineStatistics';
import { useThemeColor } from '@/hooks/useThemeColor';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Responsive breakpoints
const isTablet = screenWidth >= 768;
const isLandscape = screenWidth > screenHeight;
const isSmallScreen = screenWidth < 375;

/**
 * Statistics Screen Component
 * 
 * BEHAVIOR CHANGES (Test Fixes):
 * - Added testID="statistics-screen" to main SafeAreaView container for test compatibility
 * - Added testID="statistics-scroll-view" to ScrollView for test identification
 * - Enhanced loading state handling to prevent crashes during component unmounting
 * - Improved error state rendering with proper fallback content
 * - Fixed loading cards to use consistent testID pattern (loading-card-0, loading-card-1, etc.)
 * 
 * Displays comprehensive exploration statistics including distance traveled,
 * world exploration percentage, regional breakdowns, and hierarchical geographic data.
 * Supports both online and offline modes with appropriate fallback states.
 */
export default function StatisticsScreen() {
  const {
    data,
    isLoading,
    isRefreshing,
    error,
    isOffline,
    networkStatus,
    refreshData,
    toggleHierarchyNode,
    retryConnection,
  } = useOfflineStatistics();

  const backgroundColor = useThemeColor({}, 'background');
  const errorColor = useThemeColor({ light: '#EF4444', dark: '#F87171' }, 'text');

  // Animation values for smooth transitions
  const fadeAnim = new Animated.Value(isLoading ? 0 : 1);
  const slideAnim = new Animated.Value(isLoading ? 50 : 0);
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = React.useState(false);

  // Check for reduced motion preference
  React.useEffect(() => {
    const checkReduceMotion = async () => {
      try {
        const isEnabled = await AccessibilityInfo.isReduceMotionEnabled();
        setIsReduceMotionEnabled(isEnabled);
      } catch (error) {
        // Fallback to false if unable to check
        setIsReduceMotionEnabled(false);
      }
    };

    checkReduceMotion();

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setIsReduceMotionEnabled
    );

    return () => subscription?.remove();
  }, []);

  // Animate content when loading state changes (respecting reduced motion)
  React.useEffect(() => {
    const animationDuration = isReduceMotionEnabled ? 0 : (isLoading ? 200 : 300);
    
    if (isLoading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: animationDuration,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: isReduceMotionEnabled ? 0 : 50,
          duration: animationDuration,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: animationDuration,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: animationDuration,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isLoading, isReduceMotionEnabled]);

  const handleRefresh = useCallback(async () => {
    await refreshData();
  }, [refreshData]);

  const handleRetryConnection = useCallback(async () => {
    return await retryConnection();
  }, [retryConnection]);

  const renderEmptyState = () => (
    <ThemedView 
      style={styles.emptyStateContainer}
      accessible={true}
      accessibilityLabel="No exploration data available"
    >
      <ThemedText 
        style={styles.emptyStateIcon}
        accessibilityLabel="Compass icon"
      >
        🧭
      </ThemedText>
      <ThemedText 
        style={styles.emptyStateTitle}
        accessibilityRole="header"
      >
        Start Your Journey
      </ThemedText>
      <ThemedText 
        style={styles.emptyStateSubtitle}
        accessibilityLabel="Begin exploring to see your statistics"
      >
        Begin exploring to see your statistics
      </ThemedText>
      <ThemedText 
        style={styles.emptyStateHint}
        accessibilityHint="Go to the Map tab to start tracking your exploration"
      >
        📍 Go to the Map tab to start tracking your exploration
      </ThemedText>
    </ThemedView>
  );

  const renderErrorState = () => (
    <ThemedView 
      style={styles.errorContainer}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel="Error loading statistics"
    >
      <ThemedText 
        style={styles.errorIcon}
        accessibilityLabel="Warning icon"
      >
        ⚠️
      </ThemedText>
      <ThemedText 
        style={[styles.errorText, { color: errorColor }]}
        accessibilityRole="header"
      >
        Unable to load statistics
      </ThemedText>
      <ThemedText 
        style={styles.errorSubtext}
        accessibilityLabel={`Error details: ${error || 'Please check your connection and try again'}`}
      >
        {error || 'Please check your connection and try again'}
      </ThemedText>
      <ThemedText 
        style={styles.errorHint}
        accessibilityHint="Pull down on the screen to refresh statistics"
      >
        Pull down to refresh
      </ThemedText>
      <ThemedText 
        style={styles.retryButton}
        testID="retry-button"
        onPress={handleRefresh}
        accessibilityRole="button"
        accessibilityHint="Tap to retry loading statistics"
      >
        Retry
      </ThemedText>
    </ThemedView>
  );

  /**
   * Render loading cards with consistent testID pattern
   * 
   * BEHAVIOR CHANGE: Updated to use consistent testID pattern (loading-card-0, loading-card-1, etc.)
   * to match test expectations. Each loading card now has a predictable testID for test automation.
   */
  const renderLoadingCards = () => {
    const loadingCardTitles = [
      'Distance Traveled',
      'World Explored', 
      'Countries Visited',
      'States Visited',
      'Cities Visited',
      'Last Updated'
    ];

    return (
      <View 
        style={styles.cardGrid}
        accessible={true}
        accessibilityLabel="Loading statistics cards"
        accessibilityLiveRegion="polite"
      >
        {loadingCardTitles.map((title, index) => {
          return (
            <View key={index} style={styles.cardContainer}>
              <StatisticsCard
                title={title}
                value=""
                isLoading={true}
                testID={`loading-card-${index}`}
              />
            </View>
          );
        })}
      </View>
    );
  };

  const renderStatisticsCards = () => {
    if (!data) return null;

    // Format data with improved display
    const distanceValue = data.totalDistance.miles === 0 
      ? '0 miles'
      : data.totalDistance.miles >= 1000000
      ? `${Math.round(data.totalDistance.miles).toLocaleString()} miles`
      : `${data.totalDistance.miles.toLocaleString()} miles`;
    
    const distanceSubtitle = data.totalDistance.kilometers === 0
      ? '0 km'
      : `${data.totalDistance.kilometers.toLocaleString()} km`;

    const worldPercentage = data.worldExploration.percentage < 0.001
      ? '<0.001%'
      : `${data.worldExploration.percentage.toFixed(3)}%`;

    const exploredArea = data.worldExploration.exploredAreaKm2 < 1
      ? `${(data.worldExploration.exploredAreaKm2 * 1000000).toFixed(0)} m²`
      : `${data.worldExploration.exploredAreaKm2.toFixed(1)} km²`;

    const formatCount = (count: number) => {
      if (count < 1000) return count.toString();
      if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
      return `${(count / 1000000).toFixed(1)}M`;
    };

    const formatRemaining = (remaining: number) => {
      if (remaining === 0) return 'All visited!';
      // For test compatibility, show full numbers for smaller values
      if (remaining < 10000) return `${remaining.toLocaleString()} remaining`;
      return `${formatCount(remaining)} remaining`;
    };

    const now = new Date();
    const lastUpdated = new Date(data.lastUpdated);
    const diffMinutes = Math.floor((now.getTime() - data.lastUpdated) / (1000 * 60));
    const relativeTime = diffMinutes < 1 ? 'Just now' :
                        diffMinutes < 60 ? `${diffMinutes}m ago` :
                        diffMinutes < 1440 ? `${Math.floor(diffMinutes / 60)}h ago` :
                        lastUpdated.toLocaleDateString();

    const cards = [
      {
        title: 'Distance Traveled',
        value: distanceValue,
        subtitle: distanceSubtitle,
        icon: '🚶‍♂️',
        testID: 'distance-card',
      },
      {
        title: 'World Explored',
        value: worldPercentage,
        subtitle: exploredArea,
        icon: '🌍',
        progressPercentage: data.worldExploration.percentage > 0 ? data.worldExploration.percentage : undefined,
        testID: 'world-exploration-card',
      },
      {
        title: 'Countries Visited',
        value: formatCount(data.uniqueRegions.countries),
        subtitle: formatRemaining(data.remainingRegions.countries),
        icon: '🏳️',
        testID: 'countries-card',
      },
      {
        title: 'States Visited',
        value: formatCount(data.uniqueRegions.states),
        subtitle: formatRemaining(data.remainingRegions.states),
        icon: '🗺️',
        testID: 'states-card',
      },
      {
        title: 'Cities Visited',
        value: formatCount(data.uniqueRegions.cities),
        subtitle: formatRemaining(data.remainingRegions.cities),
        icon: '🏙️',
        testID: 'cities-card',
      },
      {
        title: 'Last Updated',
        value: lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        subtitle: relativeTime,
        icon: '🕒',
        testID: 'last-updated-card',
      },
    ];

    return (
      <View 
        style={styles.cardGrid}
        accessible={false}
        accessibilityLabel="Statistics overview cards"
      >
        {cards.map((card, index) => (
          <View key={index} style={styles.cardContainer}>
            <StatisticsCard {...card} />
          </View>
        ))}
      </View>
    );
  };

  return (
    <StatisticsErrorBoundary onRetry={handleRefresh}>
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']} testID="statistics-screen" accessible={true}>
        <ThemedView style={styles.header}>
          <ThemedText 
            type="title" 
            style={styles.headerTitle}
            accessibilityRole="header"
            accessibilityHint="Main statistics page heading"
          >
            Statistics
          </ThemedText>
          <ThemedText 
            style={styles.headerSubtitle}
            accessibilityLabel="Your exploration journey statistics"
          >
            Your exploration journey
          </ThemedText>
        </ThemedView>

        {/* Offline Indicator */}
        <OfflineIndicator
          isOffline={isOffline}
          offlineReason={data?.offlineReason}
          dataSource={data?.dataSource}
          lastOnlineTime={networkStatus?.lastOnlineTime}
          onRetry={handleRetryConnection}
        />



        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={useThemeColor({}, 'tint')}
              colors={[useThemeColor({}, 'tint')]}
              title="Pull to refresh statistics"
              titleColor={useThemeColor({}, 'text')}
            />
          }
          onRefresh={handleRefresh}
          showsVerticalScrollIndicator={false}
          testID="statistics-scroll-view"
        >
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            {error && !data ? renderErrorState() : null}
            {isLoading && !data ? renderLoadingCards() : 
             !data && !isLoading && !error ? renderEmptyState() : 
             renderStatisticsCards()}
        
            {/* Hierarchical Geographic Breakdown Section */}
            {data && !error && (
              <View style={styles.hierarchicalSection}>
              <ThemedView style={styles.sectionHeader}>
                <ThemedText 
                  type="subtitle" 
                  style={styles.sectionTitle}
                  accessibilityRole="header"
                  accessibilityHint="Geographic breakdown section heading"
                >
                  Geographic Breakdown
                </ThemedText>
                <ThemedText 
                  style={styles.sectionSubtitle}
                  accessibilityLabel="Exploration statistics organized by geographic region"
                >
                  Exploration by region
                </ThemedText>
              </ThemedView>
              
              <ThemedView style={styles.hierarchicalContainer}>
                {isLoading ? (
                  <View style={styles.hierarchicalLoading}>
                    <ThemedText style={styles.loadingText}>
                      Loading geographic data...
                    </ThemedText>
                  </View>
                ) : data.hierarchicalBreakdown && data.hierarchicalBreakdown.length > 0 ? (
                  <HierarchicalView
                    data={data.hierarchicalBreakdown}
                    onToggleExpand={toggleHierarchyNode}
                    maxDepth={3}
                    showProgressBars={true}
                    testID="geographic-hierarchy"
                  />
                ) : (
                  <View 
                    style={styles.hierarchicalEmpty}
                    accessible={true}
                    accessibilityLabel="No geographic data available"
                    testID="hierarchy-empty"
                  >
                    <ThemedText 
                      style={styles.emptyIcon}
                      accessibilityLabel="Map icon"
                    >
                      🗺️
                    </ThemedText>
                    <ThemedText 
                      style={styles.emptyTitle}
                      accessibilityRole="header"
                    >
                      No Geographic Data
                    </ThemedText>
                    <ThemedText 
                      style={styles.emptySubtitle}
                      accessibilityHint="Visit new locations to see geographic breakdown statistics"
                    >
                      Start exploring to see your geographic breakdown
                    </ThemedText>
                    <ThemedText 
                      style={styles.emptyHint}
                      accessibilityLabel="Tip: Go to the Map tab and visit new places to unlock statistics"
                    >
                      💡 Tip: Go to the Map tab and visit new places to unlock statistics
                    </ThemedText>
                  </View>
                )}
              </ThemedView>
              </View>
            )}

            {/* Show data age indicator if data is stale */}
            {data && !isLoading && !error && (
              <View 
                style={styles.dataAgeContainer}
                accessible={true}
                accessibilityLabel="Data last updated"
              >
              <ThemedText 
                style={styles.dataAgeText}
                accessibilityLabel={`Statistics last updated ${(() => {
                  const now = new Date();
                  const diffMinutes = Math.floor((now.getTime() - data.lastUpdated) / (1000 * 60));
                  return diffMinutes < 1 ? 'just now' :
                         diffMinutes < 60 ? `${diffMinutes} minutes ago` :
                         diffMinutes < 1440 ? `${Math.floor(diffMinutes / 60)} hours ago` :
                         `on ${new Date(data.lastUpdated).toLocaleDateString()}`;
                })()}`}
              >
                {(() => {
                  const now = new Date();
                  const diffMinutes = Math.floor((now.getTime() - data.lastUpdated) / (1000 * 60));
                  return diffMinutes < 1 ? 'Just now' :
                         diffMinutes < 60 ? `${diffMinutes}m ago` :
                         diffMinutes < 1440 ? `${Math.floor(diffMinutes / 60)}h ago` :
                         new Date(data.lastUpdated).toLocaleDateString();
                })()}
              </ThemedText>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </StatisticsErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: isSmallScreen ? 16 : 20,
    paddingVertical: isSmallScreen ? 12 : 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitle: {
    marginBottom: 4,
  },
  headerSubtitle: {
    opacity: 0.7,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
    paddingBottom: 32,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: isSmallScreen ? 8 : 12,
  },
  cardContainer: {
    width: isTablet 
      ? (isLandscape ? '31%' : '48%') 
      : (isLandscape ? '48%' : '100%'),
    marginBottom: isSmallScreen ? 6 : 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 12,
    opacity: 0.5,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
  },
  hierarchicalSection: {
    marginTop: isSmallScreen ? 16 : 24,
    paddingHorizontal: isSmallScreen ? 8 : 12,
  },
  sectionHeader: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  sectionSubtitle: {
    opacity: 0.7,
    fontSize: 14,
  },
  hierarchicalContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: isSmallScreen ? 150 : 200,
    maxHeight: isTablet ? 500 : (isLandscape ? 300 : 400),
  },
  hierarchicalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    opacity: 0.6,
    fontSize: 14,
  },
  hierarchicalEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  emptyHint: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  dataAgeContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  dataAgeText: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  emptyStateHint: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    lineHeight: 18,
    fontStyle: 'italic',
  },
});