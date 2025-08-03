import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

export interface StatisticsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  progressPercentage?: number;
  isLoading?: boolean;
  onPress?: () => void;
  testID?: string;
}

export function StatisticsCard({
  title,
  value,
  subtitle,
  icon,
  progressPercentage,
  isLoading = false,
  onPress,
  testID,
}: StatisticsCardProps) {
  const cardBackgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#E5E7EB', dark: '#374151' }, 'text');
  const progressBackgroundColor = useThemeColor({ light: '#F3F4F6', dark: '#374151' }, 'text');
  const progressFillColor = useThemeColor({ light: '#10B981', dark: '#34D399' }, 'tint');
  const secondaryTextColor = useThemeColor({ light: '#6B7280', dark: '#D1D5DB' }, 'text');

  const CardComponent = onPress ? TouchableOpacity : View;

  const renderContent = () => {
    if (isLoading) {
      const skeletonColor = useThemeColor({ light: '#E5E7EB', dark: '#374151' }, 'text');
      return (
        <View style={styles.loadingContainer}>
          <View style={[styles.skeletonTitle, { backgroundColor: skeletonColor }]} />
          <ActivityIndicator 
            size="large" 
            color={useThemeColor({}, 'tint')} 
            style={styles.loadingIndicator}
          />
          <View style={[styles.skeletonSubtitle, { backgroundColor: skeletonColor }]} />
        </View>
      );
    }

    return (
      <>
        <View style={styles.header}>
          {icon && (
            <ThemedText 
              style={styles.icon}
              accessibilityLabel={`${title} icon`}
            >
              {icon}
            </ThemedText>
          )}
          <ThemedText 
            type="subtitle" 
            style={styles.title}
            accessibilityRole="header"
          >
            {title}
          </ThemedText>
        </View>

        <ThemedText 
          type="title" 
          style={styles.value}
          accessibilityLabel={`${title} value: ${value}`}
        >
          {value}
        </ThemedText>

        {subtitle && (
          <ThemedText 
            style={[styles.subtitle, { color: secondaryTextColor }]}
            accessibilityLabel={`${title} subtitle: ${subtitle}`}
          >
            {subtitle}
          </ThemedText>
        )}

        {progressPercentage !== undefined && (
          <View 
            style={styles.progressContainer}
            accessibilityRole="progressbar"
            accessibilityValue={{ 
              min: 0, 
              max: 100, 
              now: progressPercentage 
            }}
            accessibilityLabel={`Progress: ${progressPercentage}%`}
          >
            <View 
              style={[
                styles.progressBackground, 
                { backgroundColor: progressBackgroundColor }
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: progressFillColor,
                    width: `${Math.max(0, Math.min(100, progressPercentage))}%`,
                  },
                ]}
              />
            </View>
          </View>
        )}
      </>
    );
  };

  return (
    <CardComponent
      style={[
        styles.container,
        {
          backgroundColor: cardBackgroundColor,
          borderColor: borderColor,
        },
      ]}
      onPress={onPress}
      accessible={true}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`Statistics card: ${title}`}
      accessibilityHint={onPress ? 'Tap for more details' : undefined}
      testID={testID}
    >
      {renderContent()}
    </CardComponent>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 8,
    marginVertical: 6,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    marginRight: 8,
    fontSize: 24,
  },
  title: {
    flex: 1,
  },
  value: {
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBackground: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  loadingIndicator: {
    marginVertical: 8,
  },
  skeletonTitle: {
    width: '60%',
    height: 20,
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonSubtitle: {
    width: '40%',
    height: 14,
    borderRadius: 4,
    marginTop: 8,
  },
});