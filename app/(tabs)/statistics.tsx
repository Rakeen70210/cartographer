import { useCallback } from 'react';
import {
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View,
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

const { width: screenWidth } = Dimensions.get('window');

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

  const handleRefresh = useCallback(async () => {
    await refreshData();
  }, [refreshData]);

  const handleRetryConnection = useCallback(async () => {
    return await retryConnection();
  }, [retryConnection]);

  const renderErrorState = () => (
    <ThemedView style={styles.errorContainer}>
      <ThemedText style={styles.errorIcon}>⚠️</ThemedText>
      <ThemedText style={[styles.errorText, { color: errorColor }]}>
        Unable to load statistics
      </ThemedText>
      <ThemedText style={styles.errorSubtext}>
        {error || 'Please check your connection and try again'}
      </ThemedText>
      <ThemedText style={styles.errorHint}>
        Pull down to refresh
      </ThemedText>
    </ThemedView>
  );

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
      <View style={styles.cardGrid}>
        {loadingCardTitles.map((title, index) => (
          <View key={index} style={styles.cardContainer}>
            <StatisticsCard
              title={title}
              value=""
              isLoading={true}
              testID={`loading-card-${index}`}
            />
          </View>
        ))}
      </View>
    );
  };

  const renderStatisticsCards = () => {
    if (!data) return null;

    // Format data with improved display
    const distanceValue = data.totalDistance.miles >= 1 
      ? `${data.totalDistance.miles.toFixed(1)} mi`
      : `${(data.totalDistance.miles * 5280).toFixed(0)} ft`;
    
    const distanceSubtitle = data.totalDistance.kilometers >= 1
      ? `${data.totalDistance.kilometers.toFixed(1)} km`
      : `${(data.totalDistance.kilometers * 1000).toFixed(0)} m`;

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
      <View style={styles.cardGrid}>
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
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.headerTitle}>
            Statistics
          </ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            Your exploration journey
          </ThemedText>
        </ThemedView>

        {/* Offline Indicator */}
        <OfflineIndicator
          isOffline={isOffline}
          offlineReason={data?.offlineReason}
          dataSource={data?.dataSource}
          lastOnlineTime={networkStatus.lastOnlineTime}
          onRetry={handleRetryConnection}
        />

        {/* Partial Data Indicator */}
        {data?.isPartialData && data?.failedCalculations && (
          <PartialDataIndicator
            failedCalculations={data.failedCalculations}
            onRetry={handleRefresh}
          />
        )}

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
          showsVerticalScrollIndicator={false}
          testID="statistics-scroll-view"
        >
          {error && !data ? renderErrorState() : null}
          {isLoading && !data ? renderLoadingCards() : renderStatisticsCards()}
        
        {/* Hierarchical Geographic Breakdown Section */}
        {data && !error && (
          <View style={styles.hierarchicalSection}>
            <ThemedView style={styles.sectionHeader}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Geographic Breakdown
              </ThemedText>
              <ThemedText style={styles.sectionSubtitle}>
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
                <View style={styles.hierarchicalEmpty}>
                  <ThemedText style={styles.emptyIcon}>🗺️</ThemedText>
                  <ThemedText style={styles.emptyTitle}>
                    No Geographic Data
                  </ThemedText>
                  <ThemedText style={styles.emptySubtitle}>
                    Start exploring to see your geographic breakdown
                  </ThemedText>
                </View>
              )}
            </ThemedView>
          </View>
        )}
        
        {/* Show data age indicator if data is stale */}
        {data && !isLoading && !error && (
          <View style={styles.dataAgeContainer}>
            <ThemedText style={styles.dataAgeText}>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    paddingHorizontal: 12,
  },
  cardContainer: {
    width: screenWidth > 600 ? '48%' : '100%',
    marginBottom: 8,
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
  hierarchicalSection: {
    marginTop: 24,
    paddingHorizontal: 12,
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
    minHeight: 200,
    maxHeight: 400,
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
});